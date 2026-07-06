MESSAGE=${1:-"que\ se\ dice\ sobre\ el\ precio\ de\ servicio\ de\ salud\ a\ personas\ afectadas\ por\ el\ VIH?"}

adb shell am broadcast -n ar.laia.palmera.dev/gnu.app.TestingEventReceiver -e message "$MESSAGE"

