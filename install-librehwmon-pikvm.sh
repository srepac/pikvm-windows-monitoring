#!/bin/bash
TARFILE="librehwmon.tar"
if [ ! -e $TARFILE ]; then
  echo "Missing $TARFILE file.  Please obtain the file from @srepac and try again."
  exit 1
fi

rw
set -x

touch /tmp/lhm-data.json
ln -sf /tmp/lhm-data.json /usr/share/kvmd/web/share/data.json

# make a backup of index.html
cp /usr/share/kvmd/web/kvm/index.html /usr/share/kvmd/web/kvm/index.html.prewinmonitor

tar xvf $TARFILE -C /

# copy the correct index.html based on which os-release is running
OSVERSION=$( grep ^ID= /etc/os-release | cut -d= -f2 )
cp /usr/share/kvmd/web/kvm/index.html.$OSVERSION /usr/share/kvmd/web/kvm/index.html

echo "Please change WEBIP= line to reflect your windows target PC IP address."
$EDITOR /usr/local/bin/poll-lhm.sh

systemctl daemon-reexec
systemctl daemon-reload
systemctl enable poll-lhm.service
systemctl restart poll-lhm.service

set +x
ro
