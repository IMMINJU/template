import sys
from pathlib import Path

# contract/proto 에서 만든 gRPC 코드 (gen/, `python -m server.gen proto`). 모듈 경로가 proto 패키지
# (app.tag.v1) 그대로라 gen/ 을 import 경로에 넣는다
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'gen'))
