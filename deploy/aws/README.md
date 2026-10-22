# Beddy 2.0 AWS 배포 (CloudShell 한 번 실행)

AWS 계정 주인이 브라우저에서 10분 정도 손을 쓰면 됩니다. 키를 복사하거나 채팅에 붙일 일이 없습니다.

## 준비
1. AWS 콘솔에 로그인하고 오른쪽 위 리전을 **미국 동부(버지니아 북부) us-east-1**로 둡니다.
2. **Amazon Bedrock → Model catalog**에서 *Anthropic Claude Haiku 4.5*를 한 번 열어 사용을 활성화합니다.
   처음이면 사용 목적을 묻는 짧은 양식이 나올 수 있습니다. 같은 방법으로 *Claude Sonnet 4.5*(선택),
   *Amazon Titan Text Embeddings V2*(보호자 질문 답변용), us-west-2 리전의 *Stability Stable Image Core*(그림, 선택)도 켜 둡니다.
   그림 모델이 없어도 앱은 동작합니다. 그때 아바타는 같은 동물의 크레용 그림으로 바뀝니다.

## 실행
1. 콘솔 위쪽의 CloudShell 아이콘(`>_`)을 엽니다.
2. **Actions → Upload file**로 `beddy2-deploy.zip`을 올립니다.
3. 아래를 붙여 넣습니다.
   ```bash
   unzip -q beddy2-deploy.zip -d beddy2 && cd beddy2 && bash deploy/aws/deploy.sh
   ```
4. 끝나면 `https://xxxx.cloudfront.net` 주소가 나옵니다. 첫 빌드와 CloudFront 전파에 10~15분 걸립니다.

## 만들어지는 것 (이름은 모두 `beddy2-`로 시작)
| 무엇 | 왜 |
|---|---|
| EC2 1대(t3.medium, Docker) | 앱 서버. 응답 뒤 기록 저장, 새벽 배치가 끊기지 않게 항상 켜진 서버 |
| CloudFront | HTTPS 주소. 서버는 CloudFront에서 오는 요청만 받습니다 |
| DynamoDB 테이블 | 계정, 기록 (암호화, 시점 복구) |
| S3 버킷 | 사진, 아바타, KB 요약 문서 (비공개, 암호화) |
| Bedrock Guardrail | 의료 진단·처방, 위험한 방법 차단, 개인정보 가림 |
| Bedrock Knowledge Base (S3 Vectors) | 보호자 질문 답변 — 대화 원문이 아닌 요약만 |
| SSM Parameter Store | 세션 키, 배치 키, 데모·심사 계정 비밀번호 (SecureString) |

## 비용 (대략, 11월 말까지)
- 서버 t3.medium + 디스크 약 월 4~5만 원(11월 말까지 약 6만 원), CloudFront·DynamoDB·S3는 몇백~몇천 원 수준
- Bedrock은 쓰는 만큼: 아이 대화 1회 몇 원 수준. 하루 상한이 걸려 있어 상한을 넘으면 오프라인 답변으로 바뀝니다.
  - `AI_DAILY_LLM_CAP`(기본 6000회), `AI_DAILY_IMAGE_CAP`(기본 200장)
- 신규 계정 크레딧이 있으면 대부분 상쇄됩니다. **결제 → 예산(Budgets)**에서 월 5만 원 알림을 꼭 걸어 두세요.

## 자주 쓰는 명령 (CloudShell, `beddy2` 폴더에서)
```bash
bash deploy/aws/status.sh      # 서버·HTTPS 상태
bash deploy/aws/redeploy.sh    # 코드 바꾼 뒤 다시 올리기 (zip을 새로 올린 다음)
bash deploy/aws/teardown.sh    # 대회 끝나고 전부 삭제
aws ssm get-parameters-by-path --path /beddy2 --with-decryption \
  --query "Parameters[?contains(Name,'PASSWORD')].[Name,Value]" --output table   # 데모·심사 비밀번호
```

## 문제가 생기면
- `status.sh`에서 app이 200이 아니면: 콘솔 → EC2 → 인스턴스 → 연결 → Session Manager로 들어가
  `sudo tail -100 /var/log/beddy-bootstrap.log`, `sudo docker logs --tail 100 beddy`를 확인합니다.
- Bedrock 권한 오류: 위 '준비' 2번의 모델 활성화를 확인합니다.
