# 프로젝트 개요
이 프로젝트는 Claude Code의 클론 버전인 코딩 에이전트 gem을 만들기 위한 것입니다. 
gem은 Gemini와 Groq를 사용하여 동작합니다.

# 주요 기술 스택
* TypeScript
* React
* ink
* fast-glob
* zod
* ai-sdk

# 폴더/파일 구조 요약
* 프로젝트 루트: package.json, tsconfig.json
* src: cli.tsx, commands, context, llm, permissions, ui, tools

# 개발 명령
* 빌드: `npm run build` 또는 `npm run tsc`
* 개발 서버 실행: `npm run dev` 또는 `tsx src/cli.tsx`
* 프로젝트 시작: `npm run start` 또는 `node dist/cli.js`
* 디렉토리 정리: `npm run clean` 또는 `rm -rf dist`

# 코딩 컨벤션 및 주의사항
* 모든 코드는 TypeScript로 작성됩니다.
* React를 사용하여 UI를 구현합니다.
* ink를 사용하여 터미널 UI를 구현합니다.
* fast-glob를 사용하여 파일 시스템을 탐색합니다.
* zod를 사용하여 데이터 validation을 수행합니다.
* ai-sdk를 사용하여 AI 관련 기능을 구현합니다.
* 주석은 한국어로 작성합니다.
