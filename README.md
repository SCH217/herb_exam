# 본초 감별 웹앱

사진을 보고 약재명을 외우는 본초 감별 시험 대비 정적 웹앱입니다.

## 공개 배포

가장 쉬운 방법은 Vercel에 이 폴더를 그대로 올리는 것입니다.

1. Vercel에서 `Add New...` -> `Project`를 선택합니다.
2. 이 폴더(`output/herb_exam_app`)를 GitHub 저장소로 올린 뒤 연결합니다.
3. Framework Preset은 `Other`, Build Command는 비워둡니다.
4. Output Directory는 `.`로 둡니다.
5. Deploy를 누르면 공개 URL이 생성됩니다.

Vercel CLI를 쓰는 경우:

```sh
cd "/Users/sonchanghyeon/Documents/본초감별시험/output/herb_exam_app"
npx vercel --prod
```

## 데이터 저장 구조

학습 기록은 서버에 저장되지 않고 각 사용자의 브라우저 `localStorage`에 저장됩니다. 따라서 같은 공개 주소를 여러 사람이 써도 각자의 진도는 서로 섞이지 않습니다.

기기를 바꾸려면 앱 상단의 `저장`으로 JSON 백업 파일을 만들고, 다른 기기에서 `불러오기`로 가져오면 됩니다.

## 저작권 확인

약재 사진이 강의자료, 교재, PDF 등에서 온 경우 공개 배포 전에 재배포 권한을 확인해야 합니다.
