import psycopg2
# PostgreSQL 접속 정보

conn = psycopg2.connect(
    host="localhost",          # 또는 실제 DB 서버 주소
    port="5432",               # 기본 포트
    database="riskqueens",     # 사용할 데이터베이스 이름
    user="ubuntu",      # 사용자 이름
    password="0000"   # 비밀번호
)