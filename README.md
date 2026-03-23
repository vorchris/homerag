# HomeRAG

HomeRAG is a personal Retrieval-Augmented Generation (RAG) system that allows you to inject your own knowledge base into Large Language Models (LLMs) like ChatGPT, Claude, and Gemini. By uploading documents and querying them, you can enhance AI responses with your personal data.

## Features

- **Document Upload**: Support for PDF, DOCX, TXT, and web pages
- **Vector Search**: Powered by Qdrant vector database and sentence transformers
- **Browser Extension**: Seamlessly integrate with popular LLM chat interfaces
- **RESTful API**: FastAPI backend for easy integration
- **Web Interface**: React-based frontend for managing collections and files
- **Dockerized**: Easy deployment with Docker Compose

## Architecture

- **Backend**: Python/FastAPI with SQLAlchemy for metadata and Qdrant for vector storage
- **Frontend**: React/TypeScript with Vite for the web interface
- **Extension**: Chrome/Firefox extension for injecting knowledge into LLM chats
- **Database**: SQLite for file metadata, Qdrant for embeddings

## Installation Guide

### Prerequisites

- Docker and Docker Compose
- Git

### Quick Start with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd homerag
   ```

2. **Create environment file**:
   Create a `.env` file in the root directory with necessary environment variables (e.g., API keys if needed).

3. **Build and run the services**:
   ```bash
   docker-compose up --build
   ```

   This will start:
   - Qdrant vector database on port 6333
   - Backend API on port 8000
   - Frontend on port 3000

4. **Access the application**:
   - Web interface: http://localhost:3000
   - API documentation: http://localhost:8000/docs

### Manual Installation

#### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables (create .env file):
   ```env
   QDRANT_HOST=localhost
   QDRANT_PORT=6333
   DB_PATH=./data/homerag.db
   STORAGE_PATH=./storage
   ```

5. Start Qdrant (if not using Docker):
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

6. Run the backend:
   ```bash
   uvicorn app.main:app --reload
   ```

#### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

#### Browser Extension

1. Navigate to the extension directory:
   ```bash
   cd extension
   ```

2. Load the extension in your browser:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the extension folder.
   - **Firefox**: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", and select `manifest.json`.

## Usage

1. **Upload Documents**: Use the web interface to upload PDF, DOCX, TXT files, or provide web URLs.

2. **Create Collections**: Organize your documents into collections for better management.

3. **Query Knowledge**: Ask questions through the web interface or use the API.

4. **Integrate with LLMs**: Install the browser extension and use it on supported LLM websites to inject relevant knowledge into your conversations.

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/upload` - Upload files
- `POST /api/query` - Query the knowledge base
- `GET /api/collections` - List collections
- `GET /api/files` - List files

For detailed API documentation, visit http://localhost:8000/docs when the backend is running.

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Backend (if needed)
cd backend
# Build Docker image or deploy as needed
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on the GitHub repository.