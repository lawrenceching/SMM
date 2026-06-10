echo "Start to build apps/ohos"

rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/dist
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/electron-common.cjs
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/core-routes.js
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/preload.js
echo "[clean] done"

pnpm --filter electron-common build
echo "[build:electron-common] done"

pnpm --filter core-routes build:cjs
echo "[build:core-routes] done"

pnpm --filter ui build
echo "[build:ui] done"


cp ./packages/electron-common/dist/electron-common.cjs ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/electron-common.cjs
cp ./packages/electron-common/ohos/preload.js ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/preload.js
cp ./packages/core-routes/dist/core-routes.cjs ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/core-routes.js
cp -r ./apps/ui/dist ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/dist
echo "[copy] done"

echo "[build] Done"