import os
import sys
import json
import random
import unicodedata
from typing import List, Dict, AsyncGenerator
from sentence_transformers import SentenceTransformer
import chromadb
from langchain_chroma import Chroma
from litellm import completion, APIConnectionError, RateLimitError
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import asyncio
import numpy as np
import settings
import tempfile
from policy_doc import generate_pdf
from langchain.schema import Document as LangChainDocument
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.prompts import PromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter

app = FastAPI(title="NIST AI RMF Combined API")
from fastapi.middleware.cors import CORSMiddleware
# litellm._turn_on_debug()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL] if settings.FRONTEND_URL else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Document:
    def __init__(self, page_content: str, metadata: Dict):
        self.page_content = page_content
        self.metadata = metadata

def normalize_string(s):
    return unicodedata.normalize('NFC', s)

def load_and_split_documents(json_file: str) -> List[Document]:
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        sys.exit(1)

    documents = []
    # Add LangChain text splitter for chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=2000,
        chunk_overlap=250,
        separators=["\n\n", "\n", " ", ""]
    )

    core_functions = data.get("NIST_AI_RMF_Overview", {}).get("5_How_Does_It_Address_and_Manage_Risks", {}).get("Core_Functions", {})
    for section, content in core_functions.items():
        sub_functions = content.get("Sub_Functions", {})
        sub_points = [
            {"id": key.replace("_", " "), "description": normalize_string(value)}
            for key, value in sub_functions.items()
        ]
        content_text = f"{section}\n"
        for sub_point in sub_points:
            content_text += f"{sub_point['id']}: {sub_point['description']}\n"
        # Split the content text into chunks
        chunks = text_splitter.split_text(content_text)
        for chunk in chunks:
            documents.append(Document(
                page_content=chunk,
                metadata={"section": section}
            ))

    overview = data.get("NIST_AI_RMF_Overview", {})
    for key, value in overview.items():
        if key == "5_How_Does_It_Address_and_Manage_Risks":
            continue
        content_text = f"{key.replace('_', ' ')}\n"
        def flatten_dict(d, parent_key=''):
            items = []
            for k, v in d.items():
                new_key = f"{parent_key}_{k}" if parent_key else k
                if isinstance(v, dict):
                    items.extend(flatten_dict(v, new_key).items())
                elif isinstance(v, list):
                    items.append((new_key, ", ".join(v)))
                else:
                    items.append((new_key, v))
            return dict(items)

        flat_content = flatten_dict(value)
        for k, v in flat_content.items():
            content_text += f"{k.replace('_', ' ')}: {normalize_string(str(v))}\n"
        # Split the content text into chunks
        chunks = text_splitter.split_text(content_text)
        for chunk in chunks:
            documents.append(Document(
                page_content=chunk,
                metadata={"section": key.replace('_', ' ')}
            ))

    for key, value in data.items():
        if key != "NIST_AI_RMF_Overview":
            content_text = f"{key.replace('_', ' ')}\n"
            flat_content = flatten_dict(value)
            for k, v in flat_content.items():
                content_text += f"{k.replace('_', ' ')}: {normalize_string(str(v))}\n"
            # Split the content text into chunks
            chunks = text_splitter.split_text(content_text)
            for chunk in chunks:
                documents.append(Document(
                    page_content=chunk,
                    metadata={"section": key.replace('_', ' ')}
                ))

    return documents

def initialize_embeddings():
    try:
        embeddings = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        return embeddings
    except Exception as e:
        sys.exit(1)

def setup_chroma_db(documents: List[Document], embedding_model) -> Chroma:
    # Convert custom Document objects to LangChainDocument objects
    langchain_docs = [LangChainDocument(page_content=doc.page_content, metadata=doc.metadata) for doc in documents]
    
    # Initialize embeddings for LangChain Chroma
    embeddings = HuggingFaceEmbeddings(model_name=settings.EMBEDDING_MODEL_NAME)
    
    # Create or load the Chroma vector store
    vector_store = Chroma(
        collection_name=settings.GENERIC_COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=settings.CHROMA_DB_PATH
    )

    # If the collection is empty, populate it with documents
    if vector_store._collection.count() == 0:
        vector_store = Chroma.from_documents(
            documents=langchain_docs,
            embedding=embeddings,
            collection_name=settings.GENERIC_COLLECTION_NAME,
            persist_directory=settings.CHROMA_DB_PATH
        )

    return vector_store

def setup_rag_chain(vector_store) -> callable:
    try:
        # Define a prompt template for consistency with the system prompt
        prompt_template = PromptTemplate(
            input_variables=["context", "question"],
            template=settings.GENERIC_SYSTEM_PROMPT + """

Context:
{context}

Question: {question}

Please provide your response in plain text format.
"""
        )

        def litellm_chain(question, context):
            prompt = prompt_template.format(context=context, question=question)
            try:
                response = completion(
                    model=settings.GENERIC_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                    max_tokens=1024
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                raise

        # Set up retriever from the vector store
        retriever = vector_store.as_retriever(search_kwargs={"k": 4})

        def rag_chain(question):
            docs = retriever.get_relevant_documents(question)
            context = "\n\n".join(doc.page_content for doc in docs)
            return litellm_chain(question, context)

        return rag_chain
    except Exception as e:
        sys.exit(1)

# Rest of the existing functions (unchanged)
def retrieve_documents(collection, query: str, embedding_model, k: int = 4) -> List[Dict]:
    query_embedding = embedding_model.encode(query).tolist()
    results = collection.query(query_embeddings=[query_embedding], n_results=k)
    retrieved_docs = []
    for i in range(len(results['ids'][0])):
        retrieved_docs.append({
            'page_content': results['documents'][0][i],
            'metadata': results['metadatas'][0][i]
        })
    return retrieved_docs

try:
    with open(settings.POLICY_JSON_FILE, 'r', encoding='utf-8') as f:
        knowledge_base = json.load(f)
except UnicodeDecodeError as e:
    sys.exit(1)

questions = []
for category, items in knowledge_base.items():
    for item in items:
        valid_answers = item.get("valid_answers", {})
        valid_answer = random.choice([valid_answers.get("va1", ""), valid_answers.get("va2", "")]) if valid_answers else ""
        questions.append({
            "category": category,
            "title": normalize_string(item["title"]),
            "query": normalize_string(item["queries"]["q"]),
            "citation": item["citation"],
            "validator": item.get("validator", ""),
            "valid_answer": valid_answer
        })

chat_histories: Dict[str, List[Dict]] = {}
user_states: Dict[str, int] = {}
conversation_states: Dict[str, str] = {}
mode_states: Dict[str, str] = {}

embedding_model = initialize_embeddings()

client_policy = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
collection_policy = client_policy.get_or_create_collection(settings.POLICY_COLLECTION_NAME)

def populate_policy_chroma():
    if collection_policy.count() == 0:
        ids = []
        documents = []
        embeddings = []
        metadatas = []
        for category, items in knowledge_base.items():
            for item in items:
                query_text = item["queries"]["q"]
                query_embedding = embedding_model.encode(query_text).tolist()
                query_id = f"{category}_{item['title']}_query"
                ids.append(query_id)
                documents.append(query_text)
                embeddings.append(query_embedding)
                metadatas.append({"type": "query", "category": category, "title": item["title"]})
                if item.get("validator"):
                    validator_text = item["validator"]
                    validator_embedding = embedding_model.encode(validator_text).tolist()
                    validator_id = f"{category}_{item['title']}_validator"
                    ids.append(validator_id)
                    documents.append(validator_text)
                    embeddings.append(validator_embedding)
                    metadatas.append({"type": "validator", "category": category, "title": item["title"]})
        collection_policy.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

def cosine_similarity(vec1: list, vec2: list) -> float:
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def check_answer_similarity(user_id: str, current_index: int, user_embedding: list) -> str:
    for msg in chat_histories[user_id]:
        if (
            msg["role"] == "user" 
            and msg["question_index"] != current_index 
            and "embedding" in msg 
            and msg["compliance"] == "Compliant"
        ):
            similarity = cosine_similarity(user_embedding, msg["embedding"])
            if similarity > 0.9:
                return f"You have already provided a similar answer for '{questions[msg['question_index']]['title']}'. Please provide a different answer for this question."
    return None

def generate_checklist(user_id: str) -> str:
    try:
        last_answers = {}
        non_compliant_answers = {}
        for msg in chat_histories[user_id]:
            if msg["role"] == "user":
                question_index = msg["question_index"]
                if msg["compliance"] == "Non-compliant":
                    non_compliant_answers[question_index] = non_compliant_answers.get(question_index, []) + [msg]
                else:
                    last_answers[question_index] = msg
        
        checklist = []
        for idx in range(len(questions)):
            if idx in last_answers or idx in non_compliant_answers:
                question = questions[idx]
                answer_text = ""
                compliance = "✅ Compliant"
                comments = "Answer accepted as compliant."
                
                if idx in non_compliant_answers:
                    for nc_answer in non_compliant_answers[idx]:
                        answer_text += f"~~{nc_answer['content'].replace('|', ' ')}~~ "
                
                if idx in last_answers:
                    answer_text += last_answers[idx]["content"].replace('|', ' ')
                    if idx in non_compliant_answers:
                        comments = "Initially non-compliant; corrected answer accepted."
                
                checklist.append({
                    "Title": question["title"],
                    "Citation": question["citation"],
                    "Query": question["query"],
                    "Answer": answer_text,
                    "Compliance": compliance,
                    "Comments": comments
                })
        
        table = "| Title | Citation | Query | Answer | Compliance | Comments |\n"
        table += "|-------|----------|-------|--------|------------|----------|\n"
        for item in checklist:
            table += f"| {item['Title'].replace('|', ' ')} | {item['Citation']} | {item['Query'].replace('|', ' ')} | {item['Answer']} | {item['Compliance']} | {item['Comments'].replace('|', ' ')} |\n"
        return table
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate checklist: {str(e)}")

def load_template(filename: str) -> str:
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return "Template not found."

def generate_policy(user_id: str, organization_name: str = None) -> str:
    template = load_template(settings.TEMPLATE_FILE)
    checklist = generate_checklist(user_id)
    if organization_name:
        org_instruction = f"Use the organization name '{organization_name}'."
    else:
        org_instruction = "Leave the organization name as [Organization Name]."
    prompt = f"Here is a policy template:\n\n{template}\n\nAnd here is the user's checklist with answers:\n\n{checklist}\n\nPlease generate a filled-in policy by integrating the user's answers into the template under the corresponding 'NIST AI RMF Sub-Categories' sections based on the 'Citation' column. Ensure that the 'Policy Details' is followed by 2 new lines, this section is always in markdown listed bullet points (within 3-5). {org_instruction} Do not hallucinate or add information not provided in the answers. Ensure the output is in Markdown format."
    messages = [{"role": "user", "content": prompt}]
    try:
        response = completion(model=settings.POLICY_GENERATOR_MODEL, messages=messages)
        policy = response["choices"][0]["message"]["content"]
        return policy
    except Exception as e:
        return f"**Error generating policy**: {str(e)}"

async def validate_answer(user_answer: str, question_index: int) -> Dict:
    validator = questions[question_index]["validator"]
    if not validator:
        return {"compliance": "Compliant", "message": "No validator provided; answer accepted as compliant."}
    
    if not user_answer or len(user_answer.strip()) < 10 or user_answer.lower() in ["i don't know", "idk", "not sure"]:
        return {
            "compliance": "Non-compliant",
            "message": "Answer lacks detail. Describe AI accountability, roles, training, and reporting mechanisms across leadership and developers."
        }
    
    messages = [
        {"role": "system", "content": settings.VALIDATOR_SYSTEM_PROMPT},
        {"role": "user", "content": f"Validator criteria: {validator}\n\nUser answer: {user_answer}\n\nEvaluate and return a JSON object with 'compliance' and 'message' fields."}
    ]
    
    try:
        response = completion(model=settings.VALIDATOR_AGENT_MODEL, messages=messages)
        content = response["choices"][0]["message"]["content"]
        try:
            validation_result = json.loads(content)
            compliance = validation_result.get("compliance", "Non-compliant")
            message = validation_result.get("message", "Invalid validator response format.")
            return {"compliance": compliance, "message": message}
        except json.JSONDecodeError as e:
            return {
                "compliance": "Non-compliant",
                "message": "Validator response invalid. Provide detailed answer on AI accountability, roles, training, and reporting."
            }
    except Exception as e:
        return {
            "compliance": "Non-compliant",
            "message": f"Validation error. Provide detailed answer on AI accountability, roles, training, and reporting."
        }

async def stream_response(response_text: str, valid_answer: str = None) -> AsyncGenerator[str, None]:
    words = response_text.split()
    for word in words:
        yield word + " "
        await asyncio.sleep(0.05)
    if valid_answer:
        yield f"\n[VALID_ANSWER]{valid_answer}[/VALID_ANSWER]\n"
    else:
        yield "\n"

async def non_streamed_response(response_text: str, valid_answer: str = None) -> AsyncGenerator[str, None]:
    yield response_text
    if valid_answer:
        yield f"\n[VALID_ANSWER]{valid_answer}[/VALID_ANSWER]\n"
    else:
        yield "\n"

class ChatRequest(BaseModel):
    content: str

try:
    documents = load_and_split_documents(settings.GENERIC_JSON_FILE)
    vector_store = setup_chroma_db(documents, embedding_model)
    rag_chain = setup_rag_chain(vector_store)
    populate_policy_chroma()
except Exception as e:
    sys.exit(1)
    
@app.get("/health")
async def health_check():
    return {"status": "Matra Bot Running!"}

@app.post("/chat/{user_id}")
async def chat(user_id: str, request: ChatRequest):
    try:
        user_input = request.content.strip().lower()

        # Initialize user if they don't exist yet
        if user_id not in chat_histories:
            chat_histories[user_id] = []
            mode_states[user_id] = "generic"

        # Handle switching to policy mode
        if user_input == "build policy" and mode_states.get(user_id, "generic") == "generic":
            mode_states[user_id] = "policy"
            chat_histories[user_id] = [{"role": "assistant", "content": questions[0]["query"]}]
            user_states[user_id] = 0
            conversation_states.pop(user_id, None)
            response_text = f"**Policy Builder Mode**: Type 'exit' to return to general Q&A.\n\n**Question**: {questions[0]['query']}"
            valid_answer = questions[0]["valid_answer"]
            chat_histories[user_id].append({"role": "assistant", "content": response_text})
            return StreamingResponse(stream_response(response_text, valid_answer), media_type="text/plain; charset=utf-8")
        
        # Handle exiting policy mode
        if user_input == "exit" and mode_states.get(user_id, "generic") == "policy":
            mode_states[user_id] = "generic"
            response_text = "Returned to general Q&A mode. Ask any NIST AI RMF-related question."
            chat_histories[user_id].append({"role": "user", "content": "exit"})
            chat_histories[user_id].append({"role": "assistant", "content": response_text})
            chat_histories[user_id] = [msg for msg in chat_histories[user_id] if msg["role"] != "user" or msg["content"].lower() != "exit"]
            return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")

        # Handle policy mode
        if mode_states.get(user_id, "generic") == "policy":
            if user_id in conversation_states:
                state = conversation_states[user_id]
                if state == "awaiting_policy_decision":
                    if user_input == "yes":
                        conversation_states[user_id] = "awaiting_organization_decision"
                        response_text = "Do you want to provide your organization name? (Yes/No)"
                        chat_histories[user_id].append({"role": "assistant", "content": response_text})
                        return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                    elif user_input == "no":
                        response_text = "Thank you for using the NIST AI RMF Policy Builder."
                        chat_histories[user_id].append({"role": "assistant", "content": response_text})
                        del conversation_states[user_id]
                        return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                    else:
                        response_text = "Please respond with 'Yes' or 'No'."
                        return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                elif state == "awaiting_organization_decision":
                    if user_input == "yes":
                        conversation_states[user_id] = "awaiting_organization_name"
                        response_text = "Please provide your organization name."
                        chat_histories[user_id].append({"role": "assistant", "content": response_text})
                        return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                    elif user_input == "no":
                        # BEGIN EDIT: Handle (APIConnectionError, RateLimitError) for policy generation
                        try:
                            policy = generate_policy(user_id)
                            response_text = f"**Here is your generated policy**:\n\n{policy}"
                            chat_histories[user_id].append({"role": "assistant", "content": response_text})
                            del conversation_states[user_id]
                            return StreamingResponse(non_streamed_response(response_text), media_type="text/plain; charset=utf-8")
                        except (APIConnectionError, RateLimitError):
                            response_text = "Our Servers are busy right now, try again later."
                            chat_histories[user_id].append({"role": "assistant", "content": response_text})
                            return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                        # END EDIT
                    else:
                        response_text = "Please respond with 'Yes' or 'No'."
                        return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                elif state == "awaiting_organization_name":
                    # BEGIN EDIT: Handle (APIConnectionError, RateLimitError) for policy generation with organization name
                    try:
                        organization_name = request.content.strip()
                        policy = generate_policy(user_id, organization_name)
                        response_text = f"**Here is your generated policy**:\n\n{policy}"
                        chat_histories[user_id].append({"role": "assistant", "content": response_text})
                        del conversation_states[user_id]
                        return StreamingResponse(non_streamed_response(response_text), media_type="text/plain; charset=utf-8")
                    except (APIConnectionError, RateLimitError):
                        response_text = "Our Servers are busy right now, try again later."
                        chat_histories[user_id].append({"role": "assistant", "content": response_text})
                        return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                    # END EDIT

            current_index = user_states[user_id]
            user_answer = request.content.strip()

            if not user_answer or len(user_answer) < 10:
                # BEGIN EDIT: Handle (APIConnectionError, RateLimitError) for answer validation
                try:
                    messages = [
                        {"role": "system", "content": settings.POLICY_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Is this user answer meaningful: '{user_answer}'? If not, suggest a response to prompt for a better answer."}
                    ]
                    response = completion(model=settings.QUERY_AGENT_MODEL, messages=messages)
                    suggested_response = response["choices"][0]["message"]["content"]
                    if "not meaningful" in suggested_response.lower():
                        chat_histories[user_id].append({"role": "assistant", "content": suggested_response})
                        response_text = f"**Error**: {suggested_response}\n\n**Question**: {questions[current_index]['query']}"
                        valid_answer = questions[current_index]["valid_answer"]
                        return StreamingResponse(stream_response(response_text, valid_answer), media_type="text/plain; charset=utf-8")
                except (APIConnectionError, RateLimitError):
                    response_text = "Our Servers are busy right now, try again later."
                    chat_histories[user_id].append({"role": "assistant", "content": response_text})
                    return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
                # END EDIT
                response_text = f"**Error**: Please provide a meaningful answer with sufficient detail.\n\n**Question**: {questions[current_index]['query']}"
                valid_answer = questions[current_index]["valid_answer"]
                return StreamingResponse(stream_response(response_text, valid_answer), media_type="text/plain; charset=utf-8")

            user_embedding = embedding_model.encode(user_answer).tolist()
            similarity_message = check_answer_similarity(user_id, current_index, user_embedding)
            category = questions[current_index]["category"]
            title = questions[current_index]["title"]

            if similarity_message:
                response_text = f"**Non-compliant**: {similarity_message}\n\n**Question**: {questions[current_index]['query']}"
                valid_answer = questions[current_index]["valid_answer"]
                return StreamingResponse(stream_response(response_text, valid_answer), media_type="text/plain; charset=utf-8")

            # BEGIN EDIT: Handle (APIConnectionError, RateLimitError) for answer validation
            try:
                validation_result = await validate_answer(user_answer, current_index)
            except (APIConnectionError, RateLimitError):
                response_text = "Our Servers are busy right now, try again later."
                chat_histories[user_id].append({"role": "assistant", "content": response_text})
                return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
            # END EDIT

            if validation_result["compliance"] == "Non-compliant":
                chat_histories[user_id].append({
                    "role": "user",
                    "content": user_answer,
                    "compliance": "Non-compliant",
                    "category": category,
                    "title": title,
                    "question_index": current_index,
                    "embedding": user_embedding
                })
                response_text = f"**Your answer is non-compliant**.\n{validation_result['message']}\n\n**Question**: {questions[current_index]['query']}"
                valid_answer = questions[current_index]["valid_answer"]
                chat_histories[user_id].append({"role": "assistant", "content": response_text})
                return StreamingResponse(stream_response(response_text, valid_answer), media_type="text/plain; charset=utf-8")
            else:
                chat_histories[user_id].append({
                    "role": "user",
                    "content": user_answer,
                    "compliance": "Compliant",
                    "category": category,
                    "title": title,
                    "question_index": current_index,
                    "embedding": user_embedding
                })
                user_states[user_id] += 1
                if user_states[user_id] < len(questions):
                    next_question = questions[user_states[user_id]]["query"]
                    chat_histories[user_id].append({"role": "assistant", "content": next_question})
                    response_text = f"**Question**: {next_question}"
                    valid_answer = questions[user_states[user_id]]["valid_answer"]
                    return StreamingResponse(stream_response(response_text, valid_answer), media_type="text/plain; charset=utf-8")
                else:
                    checklist = generate_checklist(user_id)
                    response_text = f"**All questions answered. Here's your checklist**:\n\n{checklist}\n\nWould you like to generate a policy based on your answers? (Yes/No)"
                    conversation_states[user_id] = "awaiting_policy_decision"
                    chat_histories[user_id].append({"role": "assistant", "content": response_text})
                    return StreamingResponse(non_streamed_response(response_text), media_type="text/plain; charset=utf-8")

        # Handle generic mode - optimized to avoid duplicate processing
        else:
            chat_histories[user_id].append({"role": "user", "content": request.content})
            
            # BEGIN EDIT: Handle (APIConnectionError, RateLimitError) for RAG chain
            try:
                response = rag_chain(request.content)
                full_response = response + "\n\nWould you like to build a policy now? (Type 'build policy' to start)"
                
                # Store in history
                chat_histories[user_id].append({"role": "assistant", "content": full_response})
                
                # Stream the response
                async def stream_generic_response():
                    words = full_response.split()
                    chunk_size = 5
                    for i in range(0, len(words), chunk_size):
                        chunk = " ".join(words[i:i + chunk_size]) + " "
                        yield chunk.encode('utf-8')
                        await asyncio.sleep(0.05)
                    yield "\n".encode('utf-8')
                
                return StreamingResponse(stream_generic_response(), media_type="text/markdown")
            except (APIConnectionError, RateLimitError):
                response_text = "Our Servers are busy right now, try again later."
                chat_histories[user_id].append({"role": "assistant", "content": response_text})
                return StreamingResponse(stream_response(response_text), media_type="text/plain; charset=utf-8")
            # END EDIT

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate_pdf")
async def generate_pdf_endpoint(policy_md: str = Form(...), logo: UploadFile = File(None)):
    # BEGIN EDIT: Move PNG cleanup to after PDF download
    logo_path = None
    try:
        if logo:
            # Validate logo is a PNG
            if not logo.content_type.startswith("image/png"):
                raise HTTPException(status_code=400, detail="Logo must be a PNG file.")

            # Save the logo temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
                content = await logo.read()
                temp_file.write(content)
                temp_file.close()
                logo_path = temp_file.name

        # Generate the PDF
        pdf_buffer = generate_pdf(policy_md, logo_path)

        # Return the PDF as a response
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=policy.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
    finally:
        # Clean up temporary file if it exists, after the response is sent
        if logo_path and os.path.exists(logo_path):
            os.unlink(logo_path)
    # END EDIT

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)