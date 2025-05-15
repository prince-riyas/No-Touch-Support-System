import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from rank_bm25 import BM25Okapi
from collections import Counter
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI
from langchain.docstore.document import Document
from langchain_community.vectorstores import FAISS
from core.config import settings
from utils.logger import logger
import json
import re
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from concurrent.futures import ThreadPoolExecutor
import traceback
import os

# Azure models
model = AzureChatOpenAI(
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_key=settings.AZURE_OPENAI_API_KEY,
    api_version=settings.AZURE_OPENAI_API_VERSION,
    temperature=0
)
embedding_model = AzureOpenAIEmbeddings(
    model=settings.AZURE_OPENAI_EMBED_MODEL,
    azure_endpoint=settings.AZURE_OPENAI_EMBED_API_ENDPOINT,
    api_key=settings.AZURE_OPENAI_EMBED_API_KEY,
    api_version=settings.AZURE_OPENAI_EMBED_VERSION
)

# Load and preprocess dataset
try:
    df = pd.read_excel(r'./training/test_excel.xlsx', sheet_name='Detail')
    df['Reported Issue'] = df['Reported Issue'].fillna('')
    df['Resolution provided'] = df['Resolution provided'].fillna('')
    tokenized_corpus = [doc.split() for doc in df['Reported Issue'].tolist()]
    bm25 = BM25Okapi(tokenized_corpus)
    logger.info("Loaded and preprocessed training data successfully")
except Exception as e:
    logger.error(f"Failed to load training data: {str(e)}\n{traceback.format_exc()}")
    raise

# Features and targets
features = ['Reported Issue', 'Resolution provided']
targets = ['Priority', 'Classified Team']
X = df[features]
y_priority = df['Priority']
y_team = df['Classified Team']

# Split dataset
X_train, X_test, y_pri_train, y_pri_test = train_test_split(X, y_priority, test_size=0.2, random_state=42)
X_train, X_test, y_team_train, y_team_test = train_test_split(X, y_team, test_size=0.2, random_state=42)

# Preprocessing pipeline
preprocessor = ColumnTransformer(
    transformers=[
        ('text_issue', TfidfVectorizer(max_features=100), 'Reported Issue'),
        ('text_resolution', TfidfVectorizer(max_features=100), 'Resolution provided'),
    ])
priority_pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
])
team_pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
])

# Train models
priority_pipeline.fit(X_train, y_pri_train)
team_pipeline.fit(X_train, y_team_train)
logger.info("Trained ML pipelines successfully")

# Create or load FAISS vector store with resolution in metadata
try:
    documents = [
        Document(
            page_content=row["Reported Issue"],
            metadata={
                "Priority": row["Priority"],
                "Classified Team": row["Classified Team"],
                "Resolution": row["Resolution provided"]
            }
        ) for _, row in df.iterrows()
    ]
    persistent_directory = "./faiss_sample_db"
    if os.path.exists(persistent_directory):
        logger.info(f"Loading existing FAISS vector store from {persistent_directory}")
        vector_store = FAISS.load_local(persistent_directory, embedding_model, allow_dangerous_deserialization=True)
        logger.info("Loaded FAISS vector store successfully")
    else:
        logger.info(f"Creating new FAISS vector store at {persistent_directory}")
        vector_store = FAISS.from_documents(documents, embedding_model)
        vector_store.save_local(persistent_directory)
        logger.info("Created and saved FAISS vector store successfully")
except Exception as e:
    logger.error(f"Failed to create or load FAISS vector store: {str(e)}\n{traceback.format_exc()}")
    raise

# Prediction functions
def weighted_voting(bm25_pred, rf_pred, bm25_score, threshold=0.75):
    if bm25_score >= threshold:
        weight_bm25 = 0.7
        weight_rf = 0.3
    else:
        weight_bm25 = 0.3
        weight_rf = 0.7
    combined_predictions = Counter({
        bm25_pred: weight_bm25,
        rf_pred: weight_rf
    })
    return combined_predictions.most_common(1)[0][0]

def hybrid_predict(input_data, bm25_threshold=0.75):
    try:
        logger.info(f"Running hybrid_predict with input: {input_data}")
        input_df = pd.DataFrame([input_data])
        query_text = input_data['Reported Issue']
        query_tokens = query_text.split()
        bm25_scores = bm25.get_scores(query_tokens)
        best_match_index = np.argmax(bm25_scores)
        best_match_score = bm25_scores[best_match_index]
        most_similar_ticket = df.iloc[best_match_index]
        
        bm25_priority = most_similar_ticket['Priority']
        bm25_team = most_similar_ticket['Classified Team']
        resolution_ml = most_similar_ticket['Resolution provided']
        rf_priority = priority_pipeline.predict(input_df)[0]
        rf_team = team_pipeline.predict(input_df)[0]
        
        final_priority = weighted_voting(bm25_priority, rf_priority, best_match_score, bm25_threshold)
        final_team = weighted_voting(bm25_team, rf_team, best_match_score, bm25_threshold)
        
        priority_proba = priority_pipeline.predict_proba(input_df)[0]
        priority_conf = priority_proba[np.where(priority_pipeline.classes_ == final_priority)[0][0]]
        team_proba = team_pipeline.predict_proba(input_df)[0]
        team_conf = team_proba[np.where(team_pipeline.classes_ == final_team)[0][0]]
        
        result = {
            'Priority': str(final_priority),
            'Classified Team': str(final_team),
            'Priority Confidence': float(priority_conf),
            'Team Confidence': float(team_conf),
            'BM25 Similarity Score': float(best_match_score),
            'Resolution': resolution_ml
        }
        logger.info(f"Hybrid predict result: {result}")
        return result
    except Exception as e:
        logger.error(f"Error in hybrid_predict: {str(e)}\n{traceback.format_exc()}")
        raise

def rag_predict(reported_issue, k=5):
    try:
        logger.info(f"Running rag_predict for: {reported_issue}")
        results = vector_store.similarity_search_with_score(reported_issue, k=k)
        if results:
            most_similar_doc, max_similarity = results[0]
            resolution_rag = most_similar_doc.metadata["Resolution"]
        else:
            resolution_rag = ""
            max_similarity = 0.0
        
        priority_sum = Counter()
        team_sum = Counter()
        for doc, score in results:
            priority_sum[doc.metadata["Priority"]] += score
            team_sum[doc.metadata["Classified Team"]] += score
        total_similarity = sum(score for _, score in results)
        predicted_priority = priority_sum.most_common(1)[0][0]
        confidence_priority = priority_sum[predicted_priority] / total_similarity if total_similarity > 0 else 0
        predicted_team = team_sum.most_common(1)[0][0]
        confidence_team = team_sum[predicted_team] / total_similarity if total_similarity > 0 else 0
        
        result = {
            'Priority': str(predicted_priority),
            'Classified Team': str(predicted_team),
            'Priority Confidence': float(confidence_priority),
            'Team Confidence': float(confidence_team),
            'Max Cosine Similarity': float(max_similarity),
            'Resolution': resolution_rag
        }
        logger.info(f"RAG predict result: {result}")
        return result
    except Exception as e:
        logger.error(f"Error in rag_predict: {str(e)}\n{traceback.format_exc()}")
        raise

def combine_predictions(ml_pred, rag_pred):
    final_pred = {}
    confidence_keys = {'Priority': 'Priority Confidence', 'Classified Team': 'Team Confidence'}
    for field in ['Priority', 'Classified Team']:
        ml_value = ml_pred[field]
        rag_value = rag_pred[field]
        if ml_value == rag_value:
            final_pred[field] = ml_value
        else:
            ml_conf = ml_pred[confidence_keys[field]]
            rag_conf = rag_pred[confidence_keys[field]]
            final_pred[field] = ml_value if ml_conf > rag_conf else rag_value
    return final_pred

@tool
def run_ml_prediction(reported_issue: str) -> str:
    """Run ML-based prediction (Random Forest + BM25) for a reported issue."""
    try:
        input_data = {'Reported Issue': reported_issue, 'Resolution provided': ''}
        result = hybrid_predict(input_data)
        return json.dumps(result)
    except Exception as e:
        logger.error(f"Error in run_ml_prediction: {str(e)}\n{traceback.format_exc()}")
        raise

@tool
def run_rag_prediction(reported_issue: str) -> str:
    """Run RAG-based prediction (FAISS vector search) for a reported issue."""
    try:
        result = rag_predict(reported_issue)
        return json.dumps(result)
    except Exception as e:
        logger.error(f"Error in run_rag_prediction: {str(e)}\n{traceback.format_exc()}")
        raise

@tool
def combine_ml_rag_predictions(ml_result: str, rag_result: str) -> str:
    """Combine ML and RAG predictions based on confidence scores."""
    try:
        ml_pred = json.loads(ml_result)
        rag_pred = json.loads(rag_result)
        final_pred = combine_predictions(ml_pred, rag_pred)
        return json.dumps(final_pred)
    except Exception as e:
        logger.error(f"Error in combine_ml_rag_predictions: {str(e)}\n{traceback.format_exc()}")
        raise

@tool
def decide_issue_novelty(ml_result: str, rag_result: str) -> str:
    """Decide if the issue is new based on similarity scores."""
    try:
        ml_pred = json.loads(ml_result)
        rag_pred = json.loads(rag_result)
        sim_ml = ml_pred['BM25 Similarity Score']
        sim_rag = rag_pred['Max Cosine Similarity']
        is_new = not (sim_ml >= 8.0 or sim_rag >= 0.6)
        return json.dumps({"is_new_issue": is_new})
    except Exception as e:
        logger.error(f"Error in decide_issue_novelty: {str(e)}\n{traceback.format_exc()}")
        raise

@tool
def run_parallel_predictions(reported_issue: str) -> str:
    """Run ML and RAG predictions in parallel for efficiency."""
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_ml = executor.submit(hybrid_predict, {'Reported Issue': reported_issue, 'Resolution provided': ''})
            future_rag = executor.submit(rag_predict, reported_issue)
            ml_result = future_ml.result()
            rag_result = future_rag.result()
        result = {"ml_result": ml_result, "rag_result": rag_result}
        logger.info(f"Parallel predictions result: {result}")
        return json.dumps(result)
    except Exception as e:
        logger.error(f"Error in run_parallel_predictions: {str(e)}\n{traceback.format_exc()}")
        raise

tools = [
    run_ml_prediction,
    run_rag_prediction,
    combine_ml_rag_predictions,
    decide_issue_novelty,
    run_parallel_predictions
]
agent_executor = create_react_agent(model, tools=tools)

def predict(reported_issue):
    try:
        logger.info(f"Running predict for issue: {reported_issue}")
        query = (
            f"Analyze this reported issue: '{reported_issue}'. "
            "Use 'run_parallel_predictions' to get ML and RAG results efficiently. "
            "Then, use 'combine_ml_rag_predictions' to merge the predictions for Priority and Classified Team. "
            "Use 'decide_issue_novelty' to determine if it's a new issue. "
            "For known issues, set 'Resolution' to the resolution from RAG if its 'Max Cosine Similarity' >= 0.6, "
            "else set it to the resolution from ML. "
            "For new issues, generate a resolution based on the ticket description and the following similar resolutions: "
            "- ML Resolution (BM25-based): {{ml_resolution}} (Similarity: {{ml_similarity}}) "
            "- RAG Resolution (Embedding-based): {{rag_resolution}} (Similarity: {{rag_similarity}}) "
            "Ensure the generated resolution is consistent with these examples but tailored to the new issue. "
            "Return a JSON object with 'Priority', 'Classified Team', 'Resolution', 'is_new_issue', and 'combined_score'."
        )
        # Run parallel predictions to get ML and RAG results
        parallel_result = json.loads(run_parallel_predictions(reported_issue))
        ml_pred = parallel_result["ml_result"]
        rag_pred = parallel_result["rag_result"]
        
        # Extract resolutions and similarity scores
        ml_resolution = ml_pred.get("Resolution", "")
        rag_resolution = rag_pred.get("Resolution", "")
        ml_similarity = ml_pred.get("BM25 Similarity Score", 0.0)
        rag_similarity = rag_pred.get("Max Cosine Similarity", 0.0)
        
        # Calculate combined score
        combined_score = (ml_pred["Priority Confidence"] + rag_pred["Priority Confidence"] +
                         ml_pred["Team Confidence"] + rag_pred["Team Confidence"]) / 4
        
        # Format the query with resolutions
        formatted_query = query.replace("{{ml_resolution}}", ml_resolution or "None") \
                              .replace("{{rag_resolution}}", rag_resolution or "None") \
                              .replace("{{ml_similarity}}", str(ml_similarity)) \
                              .replace("{{rag_similarity}}", str(rag_similarity))
        
        inputs = {"messages": [("user", formatted_query)]}
        response = agent_executor.invoke(inputs)
        for msg in response["messages"]:
            if msg.type == "ai" and msg.content:
                content = msg.content.strip()
                json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                    try:
                        result = json.loads(json_str)
                        result["combined_score"] = combined_score
                        logger.info(f"Predict result: {result}")
                        return result
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error in predict: {str(e)}")
                        continue
                else:
                    try:
                        result = json.loads(content)
                        result["combined_score"] = combined_score
                        logger.info(f"Predict result: {result}")
                        return result
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decode error in predict: {str(e)}")
                        continue
        logger.error("Agent failed to produce valid output")
        raise ValueError("Agent failed to produce valid output")
    except Exception as e:
        logger.error(f"Error in predict: {str(e)}\n{traceback.format_exc()}")
        raise