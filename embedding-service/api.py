from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from process_real_report import process_report


app = FastAPI(
    title="WhisperNet Semantic Service",
    description="Semantic report processing service for WhisperNet",
    version="1.0.0"
)


class ReportRequest(BaseModel):
    report_id: int


@app.get("/")
def root():
    return {
        "service": "WhisperNet Semantic Service",
        "status": "running"
    }


@app.post("/process-report")
def process_report_endpoint(request: ReportRequest):
    try:
        result = process_report(request.report_id)

        return {
            "success": True,
            "report_id": request.report_id,
            "result": result
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )