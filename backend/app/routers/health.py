from fastapi import APIRouter


router = APIRouter(tags=["Health"])


@router.get("/")
def root():
    return {
        "message": "Company ERP backend is running",
    }


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Company ERP backend is running",
    }