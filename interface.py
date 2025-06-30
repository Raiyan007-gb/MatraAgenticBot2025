import streamlit as st
import requests
from typing import Generator
from policy_doc import generate_pdf
import os

st.set_page_config(page_title="NIST AI RMF Assistant - Maatra", layout="wide")
st.title("NIST AI RMF Assistant - Maatra")

# User ID input
if "user_id" not in st.session_state:
    st.session_state.user_id = ""

user_id = st.text_input("Enter your User ID", value=st.session_state.user_id)
if user_id:
    st.session_state.user_id = user_id

# Initialize chat history and mode in session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "mode" not in st.session_state:
    st.session_state.mode = "generic"

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"], unsafe_allow_html=True)

# Function to stream API response
def stream_api_response(url: str, data: dict) -> Generator[str, None, None]:
    try:
        with requests.post(url, json=data, stream=True, timeout=10) as response:
            if response.status_code == 200:
                for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                    if chunk:
                        yield chunk
            else:
                yield f"**Error**: {response.status_code} - {response.text}"
    except requests.RequestException as e:
        yield f"**Failed to connect to the server**: {str(e)}"

# Chat input
if user_id:
    # Display mode-specific instructions
    if st.session_state.mode == "policy":
        st.info("**Policy Builder Mode**: Type 'exit' to return to general Q&A.")
    
    if prompt := st.chat_input("Type your message"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        try:
            api_url = f"http://localhost:8088/chat/{user_id}"
            response_generator = stream_api_response(api_url, {"content": prompt})
            assistant_response = st.write_stream(response_generator)
            st.session_state.messages.append({"role": "assistant", "content": assistant_response})

            # Update mode based on response
            if "Policy Builder Mode" in assistant_response:
                st.session_state.mode = "policy"
            elif "Returned to general Q&A mode" in assistant_response:
                st.session_state.mode = "generic"

        except Exception as e:
            st.error(f"**Error processing response**: {str(e)}")

    # Document generation options after policy is displayed
    if st.session_state.messages and st.session_state.messages[-1]["role"] == "assistant":
        last_message = st.session_state.messages[-1]["content"]
        if "**Here is your generated policy**" in last_message:
            st.subheader("Generate Document")
            st.write("Would you like to generate a PDF version of this policy?")
            logo_choice = st.radio("Do you have a company logo you’d like to include in the document?", ["Yes", "No"])
            logo_file = None
            if logo_choice == "Yes":
                logo_file = st.file_uploader("Upload logo (.png)", type=["png"], accept_multiple_files=False)
            if st.button("Generate PDF"):
                logo_path = None
                if logo_file:
                    logo_path = "temp_logo.png"
                    with open(logo_path, "wb") as f:
                        f.write(logo_file.getbuffer())
                policy_content = last_message.split("**Here is your generated policy**:\n\n")[1]
                buffer = generate_pdf(policy_content, logo_path)
                st.download_button(
                    label="Download PDF",
                    data=buffer,
                    file_name="policy.pdf",
                    mime="application/pdf"
                )
                if logo_path and os.path.exists(logo_path):
                    os.remove(logo_path)
else:
    st.warning("Please enter a User ID to start.")