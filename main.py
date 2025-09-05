from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from service.get_chart import generate_company
import uvicorn

app = FastAPI()
templates = Jinja2Templates(directory="templates")


@app.get("/html", response_class=HTMLResponse)
def html(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/api/portfolio")
def get_portfolio(limit: int = 20):
    portfolio = [generate_company(i) for i in range(limit)]
    return portfolio


# @app.get("/html", response_class=HTMLResponse)
# def html(request: Request):
#     cur = conn.cursor()
#     sql = """SELECT * FROM financialstatements;"""
#         # # 쿼리 실행
#     # 임시저장소한테 실행해달라고 요청
#     cur.execute(sql)
#     data = cur.fetchall()

#     # # 변경사항 커밋
#     conn.commit()

#     return templates.TemplateResponse("test.html", {"request": request, "data": data[0]})

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)