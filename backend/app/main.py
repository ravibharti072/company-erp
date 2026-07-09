from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import (
    auth,
    health,
    companies,
    users,
    attendance,
    tasks,
    sales,
    commissions,
    freelancers,
    dashboard,
)


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Company Management ERP",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(tasks.router)
app.include_router(sales.router)
app.include_router(commissions.router)
app.include_router(freelancers.router)
app.include_router(dashboard.router)