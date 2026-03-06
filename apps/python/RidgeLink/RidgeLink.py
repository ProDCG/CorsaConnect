import os
import sys
import platform
try:
    if platform.architecture()[0] == "64bit":
        sysdir = "stdlib64"
    else:
        sysdir = "stdlib"
    sys.path.insert(
        len(sys.path), 'apps/python/third_party')
    os.environ['PATH'] += ";."
    sys.path.insert(len(sys.path), os.path.join(
        'apps/python/third_party', sysdir))
    os.environ['PATH'] += ";."
except Exception as e:
    ac.log("[ERROR] Error importing libraries: %s" % e)

from sim_info import info

while True:
    print(info.graphics.tyreCompound, info.physics.rpms, info.static.playerNick)