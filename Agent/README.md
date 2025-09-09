# AI Policy Question & PDF Generator

This project allows you to interact with an AI system that asks compliance or policy-related questions, validates them, and generates a final PDF based on a markdown template.

---

## 🚀 Getting Started

### 1. Run the API server:

```bash
python api.py
```

### 2. Run the Streamlit interface:

```bash
streamlit run interface.py
```

---

## 🛠️ Configuration & Notes

* **Groq API Key**:
  You need to collect your API key from [Groq Console](https://console.groq.com/keys) and place it in the `.env` file.

* **Question File**:
  The questions asked by the system are loaded from a JSON file.

  * For full use, edit `finalized_answer_list.json`.
  * For quick testing, `files.json` contains a smaller subset of questions.
  * You can easily switch between them inside `api.py`.
  * Please use [QusetionAnswerDoc](https://docs.google.com/document/d/185qlNMl3SJTG1Lp3NOHDiP3aKsbJ9qkTI-Z3H-6-Z-A/edit?usp=sharing) to answer the questions.

* **PDF Generation**:

  * Handled entirely by `policy_doc.py`, which is used by `api.py` to generate the final PDF output.

* **Template**:

  * The `template.md` file contains the markdown template used for PDF generation.

---

## ⚠️ Current Status

* The code in `api.py` is **not yet modularized or containerized (Docker)**.
* These improvements are currently in progress.

---

## 📁 File Structure Overview

```
.
├── api.py                     # FastAPI backend for question-answering and PDF generation
├── interface.py               # Streamlit frontend interface
├── policy_doc.py              # PDF generation logic
├── finalized_answer_list.json # Full question set
├── files.json                 # Test question set (subset)
├── template.md                # Markdown template for final PDF
├── requirements.txt           # Python dependencies
├── README.md                  # You're here!
```

---

## 🧪 Example Use Case

Answer AI-generated questions via the interface or API, then export your results in a standardized policy PDF for review or submission.

---

## 📬 Contact

For questions, feedback, or contributions, feel free to open an issue or reach out to the team.
