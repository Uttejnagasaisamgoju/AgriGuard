@echo off
set "ANDROID_HOME=C:\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.15.6-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Accepting Android SDK licenses...
cmd.exe /c "echo y | C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat --licenses"

echo Installing platform-tools, build-tools 34.0.0, and platforms android-34...
cmd.exe /c "echo y | C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat --install \"platform-tools\" \"build-tools;34.0.0\" \"platforms;android-34\""

echo Done!
