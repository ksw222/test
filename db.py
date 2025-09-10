import os,psycopg2
# PostgreSQL 접속 정보

# 프로젝트 루트에 빈 파일 생성(UTF-8)
DUMMY_PASSFILE = os.path.join(os.path.dirname(__file__), ".pgpass.empty")
if not os.path.exists(DUMMY_PASSFILE):
    open(DUMMY_PASSFILE, "w", encoding="utf-8").close()

conn = psycopg2.connect(
    host="localhost",          # 또는 실제 DB 서버 주소
    port="5432",               # 기본 포트
    database="riskqueens",     # 사용할 데이터베이스 이름
    user="ubuntu",      # 사용자 이름
    password="0000",   # 비밀번호
    passfile=DUMMY_PASSFILE,        # ← pgpass 우회
    options="-c client_encoding=UTF8"
)

