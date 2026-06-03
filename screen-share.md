

# get repo
git clone https://github.com/Genymobile/scrcpy ../scrcpy

# for Debian/Ubuntu
sudo apt install ffmpeg libsdl3-0 libusb-1.0-0 wget \
                 gcc git pkg-config meson ninja-build libsdl3-dev \
                 libavcodec-dev libavdevice-dev libavformat-dev libavutil-dev \
                 libswresample-dev libusb-1.0-0-dev libv4l-dev

Se asume que el SDK de android con `adb` ya esta instalado

# Ejecutar el script instalacion
cd ../srccpy
./install_release.sh


Mas aca https://github.com/Genymobile/scrcpy/blob/master/doc/linux.md

