---
description: Concurrent Development Setup for LXStudio and Orchid219
---

# Concurrent Development Setup

This workflow ensures that **LXStudio** and **Orchid219** can be developed simultaneously on the same machine without port or database conflicts.

## Configuration Standards

We assign distinct ports and database names to each project.

| Component | LX Studio (Primary) | Orchid219 (Secondary) |
| :--- | :--- | :--- |
| **Frontend** | `3000` | `3001` |
| **Backend** | `8000` | `8001` |
| **Database** | `lxstudio` | `orchid219` |

## Setup Instructions

### 1. LX Studio (Primary)
This project uses the default Next.js and FastAPI ports.

*   **Frontend**: Ensure `apps/web/.env` contains `PORT=3000`.
*   **Backend**: Ensure `apps/api/.env` contains `PORT=8000` and `DB_NAME=lxstudio`.
*   **Start**: Run `npm run dev` and `bash start.sh` as usual.

### 2. Orchid219 (Secondary)
This project is explicitly configured to offset its ports by +1.

*   **Frontend Config**: 
    *   File: `frontend/.env.local`
    *   Content:
        ```env
        PORT=3001
        NEXT_PUBLIC_API_URL=http://localhost:8001
        ```
*   **Backend Config**:
    *   File: `backend/.env`
    *   Content:
        ```env
        DATABASE_URL=postgresql://localhost:5432/orchid219
        ```
*   **Startup**:
    *   **Frontend**: `npm run dev` (Runs on 3001)
    *   **Backend**: Use the custom script `bash start.sh` in the backend directory (Runs on 8001).
        *   script content: `PYTHONPATH=$(pwd) ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload`

## Troubleshooting conflicts
If you encounter "Address already in use":
1.  Run `lsof -i :3000,3001,8000,8001` to see what is running.
2.  Kill the conflicting process.
3.  Restart the specific project service using the ports defined above.
