INDUSTRIES = ["제조", "건설", "서비스", "유통", "IT", "운송", "에너지", "바이오"]

def risk_grade(p: float) -> str:
    """부실확률(default_prob)에 따른 위험등급"""
    if p > 0.35:
        return "High"
    elif p > 0.18:
        return "Medium"
    return "Low"

def generate_company(idx: int):
    """더미 기업 데이터 한 건 생성"""
    industry = INDUSTRIES[idx % len(INDUSTRIES)]
    debt_ratio = round(random.uniform(50, 500), 1)   # 부채비율(%)
    icr = round(random.uniform(0.3, 6.5), 2)        # 이자보상배율
    default_prob = round(
        min(max((debt_ratio / 1000) + (1 / (icr + 1.5)) + random.uniform(-0.1, 0.1), 0.01), 0.9),
        3
    )
    risk = risk_grade(default_prob)

    # 최근 8분기 더미 데이터
    quarters = []
    for q in range(8, 0, -1):
        quarters.append({
            "q": f"202{4 if q > 4 else 5}Q{q if q <= 4 else q-4}",  # 예: 2024Q4, 2025Q1
            "debt": round(min(max(debt_ratio + random.uniform(-40, 40), 20), 900), 1),
            "icr": round(min(max(icr + random.uniform(-1.2, 1.2), 0.1), 9), 2),
            "prob": round(min(max(default_prob + random.uniform(-0.1, 0.1), 0.01), 0.95), 3),
        })

    return {
        "id": f"C{1000 + idx}",
        "name": f"기업 {chr(65 + (idx % 26))}-{idx}",
        "industry": industry,
        "debt_ratio": debt_ratio,
        "icr": icr,
        "default_prob": default_prob,
        "risk": risk,
        "quarters": quarters
    }