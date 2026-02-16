@echo off
git checkout main && git merge Zkt_dev && git push && npx cap sync && git checkout Zkt_dev
echo.
echo Deploy tamamlandi!
pause
