# Claude (gem)

Gemini 기반의 Claude Code 클론 CLI 도구입니다. (Groq 폴백 지원)
터미널에서 파일 읽기/편집, 명령 실행, 코드 검색, 웹 검색을 할 수 있습니다.

## 설치

    git clone https://github.com/buriburiyj/gem.git
    cd gem
    pnpm install
    npm run build
    npm pack
    npm install -g ./gem-0.0.1.tgz

## API 키 설정

`~/.claude/.env` 파일에 키를 넣으세요.

    GEMINI_API_KEY=your_gemini_key
    GROQ_API_KEY=your_groq_key
    TAVILY_API_KEY=your_tavily_key

## 사용법

    claude              # 새로 시작
    claude resume       # 최근 세션 이어서
    claude sessions     # 세션 목록 (폴더별)
    claude delete <id>  # 세션 삭제
    claude --help       # 도움말
    claude --version    # 버전 확인

### 별칭

    claude --list          = claude sessions
    claude --continue, -c  = claude resume

## 앱 내 슬래시 명령

/help /clear /compact /context /cost /model /memory /sessions /resume /delete /theme /backend /init /setup /exit

## 주요 기능

- Gemini 자동 라우팅 (간단한 질문은 flash, 복잡한 작업은 pro)
- 세션을 ~/.claude/sessions/ 에 통합 저장, 폴더별 그룹 표시
- resume 시 원래 작업 폴더로 자동 이동
- 웹 검색 (advanced 모드)
- 파일 편집 시 diff 미리보기
- 툴: read_file, write_file, edit_file, bash, glob, grep, ls, web_search

## 기술 스택

- Ink (터미널 UI)
- Vercel AI SDK (LLM 연동)
- TypeScript

## 라이선스

MIT
