echo "Start to build apps/ohos"

rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/dist
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/core-routes.js
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/preload.js
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/activate-ohos-file-access-permission.js
rm -rf apps/ohos/web_engine/src/main/resources/resfile/resources/app/electron-common.cjs
echo "[clean] done"

pnpm --filter core-routes build:cjs
echo "[build:core-routes] done"

pnpm --filter ui build
echo "[build:ui] done"

pnpm --filter @smm/ohos-electron-main build
echo "[build:ohos-electron-main] done"

cp ./packages/core-routes/dist/core-routes.cjs ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/core-routes.js
cp ./packages/electron-common/ohos/preload.js ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/preload.js
cp -r ./apps/ui/dist ./apps/ohos/web_engine/src/main/resources/resfile/resources/app/dist
echo "[copy] done"

echo "[build] Done"
