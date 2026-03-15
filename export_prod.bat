@echo off
setlocal

set OUTPUT=output

:: Clear or create output directory
if exist "%OUTPUT%" (
    rd /s /q "%OUTPUT%"
)
mkdir "%OUTPUT%"

:: Root files
copy /y "index.html"                    "%OUTPUT%\index.html"
copy /y "favicon.ico"                   "%OUTPUT%\favicon.ico"
copy /y "touch-icon-iphone.png"         "%OUTPUT%\touch-icon-iphone.png"
copy /y "touch-icon-iphone-retina.png"  "%OUTPUT%\touch-icon-iphone-retina.png"

:: assets/css
mkdir "%OUTPUT%\assets\css"
copy /y "assets\css\style.css"          "%OUTPUT%\assets\css\style.css"

:: assets/images
mkdir "%OUTPUT%\assets\images"
copy /y "assets\images\noSignal.svg"    "%OUTPUT%\assets\images\noSignal.svg"

:: assets/js
mkdir "%OUTPUT%\assets\js"
copy /y "assets\js\cctv.js"            "%OUTPUT%\assets\js\cctv.js"
copy /y "assets\js\timer.js"           "%OUTPUT%\assets\js\timer.js"
copy /y "assets\js\utilities.js"       "%OUTPUT%\assets\js\utilities.js"

:: data
mkdir "%OUTPUT%\data"
copy /y "data\data.js"                 "%OUTPUT%\data\data.js"

echo.
echo Export complete: %OUTPUT%\
endlocal
