import OpenAI from "openai";
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY 환경변수를 설정하세요.");
}
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
