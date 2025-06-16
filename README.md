# step 1 : Download and install libreHardwareMonitor on windows pc https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases
# step 2 : Run libreHardwareMonitor and configure it
![image](https://github.com/user-attachments/assets/5dd822b7-5298-4a0e-ab25-78cd074f9a89)

# step 3 : on pikvm terminal root
```
rw 
touch /tmp/lhm-data.json
ln -sf "/tmp/lhm-data.json" "/usr/share/kvmd/web/share/data.json"
vi /usr/local/bin/poll-lhm.sh
```

add this content: 
```
#!/bin/bash
# number of seconds for next poll
SECS=5
# IP of windows target PC
WINIP="192.168.1.19"

# url for libreHardwareMonitor
URL="http://${WINIP}:8085/data.json"
TMP_FILE="/tmp/lhm-data.json"

while true; do
    if curl -s --fail --connect-timeout 1 --max-time 2 "$URL" -o "${TMP_FILE}.tmp"; then
        mv "${TMP_FILE}.tmp" "$TMP_FILE"
    fi
    sleep 1
done
```

add exec perm
```chmod +x /usr/local/bin/poll-lhm.sh```

create service

```vi /etc/systemd/system/poll-lhm.service```

with the following content
```
[Unit]
Description=Poll LibreHardwareMonitor JSON and write to KVMD
After=network.target

[Service]
ExecStart=/usr/local/bin/poll-lhm.sh
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```


run these commands to start the poll-lhm service:
```
systemctl daemon-reexec
systemctl daemon-reload
systemctl enable --now poll-lhm.service
```


# step 4 : Copy the js file into the kvmd web repo: 
```/usr/share/kvmd/web/share/js/lhm-monitor.js```

# step 5 : Modify the /usr/share/kvmd/web/kvm/index.html
in header section, add line 54 : 
```<script src="../share/js/lhm-monitor.js"></script>```

and add after  
```
<li class="right feature-disabled" id="gpio-dropdown">...</li>
```
this : 
```
      <li class="right" id="monitor-dropdown"><a class="menu-button" id="monitor-menu-button" href="#"><span></span></a>
        <div class="menu" id="monitor-menu"></div>
      </li>
```

# NOTE:  if you cannot have access to http://yourip:8085/data.json on pikvm, it's because your windows firewall blocked the port, add exception for this port on your firewall

visual : 

![demo monitor info pikvm](https://github.com/user-attachments/assets/430f482b-bb53-42ac-ae81-c3ce247580fb)



