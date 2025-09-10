## 폴더형태만드릭

 nest g resource 폴더명 -> 서비스 컨트롤러 dto 모델 다만들어짐 

npm install drizzle-orm -D drizzle-kit pg;


# 마이그레이션 SQL 생성
npx drizzle-kit generate --config=drizzle.config.ts

# 실제 DB에 적용
npx drizzle-kit migrate --config=drizzle.config.ts

# 카테고리 데이터 넣기
npm run seed:categories  

npm run start:dev

# 삭제 
dropdb   -U postgres DBNAME
# 만들기 
createdb -U postgres DBNAME


npx drizzle-kit migrate


# 카테고리 실행
 "seed:music-categories": "ts-node src/scripts/seedCategories.ts" 