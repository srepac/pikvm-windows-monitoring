 function fetchAndLog() {
   fetch("../share/data.json")
     .then(res => res.json())
     .then(data => {
       const temps = [];
       const tempsCores = [];
       const loads = [];
       const loadsCores = [];
       const mems = [];
       const disks = [];
       const gpus = [];
 
       let coreAverageVal = "";
       let cpuTotalVal = "";
       let memUsedVal = "";
 
       function extractGpuInfo(node, gpuName) {
         if (!node || typeof node !== "object") return;
 
         const text = node.Text || "";
         const type = node.Type || "";
         const value = node.Value || "";
         const min = node.Min || "";
         const max = node.Max || "";
 
         const keys = ["D3D 3D", "D3D Copy", "D3D Video Decode", "D3D Video Encode", "D3D Video Processing"];
         if (type === "Load" && keys.some(k => text.startsWith(k))) {
           const key = keys.find(k => text.startsWith(k));
           const gpu = gpus.find(g => g.name === gpuName);
           if (gpu) {
             gpu.loads[key] = gpu.loads[key] || [];
             gpu.loads[key].push({ value, min, max });
           }
         }
 
         if (Array.isArray(node.Children)) {
           node.Children.forEach(child => extractGpuInfo(child, gpuName));
         }
       }
 
       function traverse(node, parentDisk = null) {
         if (!node || typeof node !== "object") return;
 
         const text = node.Text || "";
         const type = node.Type || "";
         const value = node.Value || "";
         const min = node.Min || "";
         const max = node.Max || "";
         const image = node.ImageURL || "";
         const sensorId = node.SensorId || "";
 
         // 🌡️ CPU temperature
         if (type === "Temperature") {
           if (/Core (Max|Average)/.test(text)) {
            const entry = { text, value, min, max };
            if (text === "Core Average") {
             temps.unshift(entry);  // insert Core Average at the beginning
             coreAverageVal = value;
            } else {
             temps.push(entry);
            }  
           } else if (/^CPU Core #\d+$/.test(text)) {
             tempsCores.push({ text, value, min, max });
           }
         }
 
         // ⚙️ CPU load
         if (type === "Load") {
           if (text === "CPU Total") {
             loads.push({ text, value, min, max });
             cpuTotalVal = value;
           } else if (text === "CPU Core Max") {
             loads.push({ text, value, min, max });
           } else if (/^CPU Core #\d+/.test(text)) {
             loadsCores.push({ text, value, min, max });
           }
         }
 
         // 🝙 RAM memory
         if (text === "Memory Used") {
           mems.push({ text, value, min, max });
           memUsedVal = value;
         } else if (text === "Memory Available") {
           mems.push({ text, value, min, max });
         }
 
         // 💾 Disk detection
         if (image === "images_icon/hdd.png") {
           parentDisk = text;
           disks.push({ disk: parentDisk, entries: [], type: null });
         }
 
         if (parentDisk && ((type === "Temperature" && text === "Temperature") || (type === "Load" && text === "Used Space"))) {
           const disk = disks.find(d => d.disk === parentDisk);
           if (disk) {
             if (!disk.type && sensorId) {
               if (sensorId.includes("/ssd/")) disk.type = "SSD";
               else if (sensorId.includes("/hdd/")) disk.type = "HDD";
               else if (sensorId.includes("/nvme/")) disk.type = "NVMe";
             }
             disk.entries.push({ label: text, value, min, max });
           }
         }
 
         // 🎮 GPU section
         if (
           Array.isArray(node.Children) &&
           node.Children.some(c => c.Children?.some(cc => cc.Text?.startsWith("D3D 3D")))
         ) {
           const gpuName = text;
           const gpu = { name: gpuName, loads: {} };
           gpus.push(gpu);
           node.Children.forEach(child => extractGpuInfo(child, gpuName));
         }
 
         if (Array.isArray(node.Children)) {
           node.Children.forEach(child => traverse(child, parentDisk));
         }
       }
 
       traverse(data);
 
       // 🔍 Preserve open <details> blocks
       const openSummaries = Array.from(document.querySelectorAll("#monitor-menu details[open] > summary"))
         .map(summary => summary.textContent.trim());
 
       function makeTable(title, entries, headers = ["Name", "Value", "Min", "Max"]) {
         let html = `<h3 style="margin-top:10px;">${title}</h3>`;
         html += `<table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
         <tr>${headers.map(h => `<th style="border:1px solid #ccc; text-align:left; padding:4px;">${h}</th>`).join("")}</tr>`;
         entries.forEach(e => {
           html += `<tr>
             <td style="border:1px solid #ccc; padding:4px;">${e.text}</td>
             <td style="border:1px solid #ccc; padding:4px;">${e.value}</td>
             <td style="border:1px solid #ccc; padding:4px;">${e.min}</td>
             <td style="border:1px solid #ccc; padding:4px;">${e.max}</td>
           </tr>`;
         });
         html += `</table>`;
         return html;
       }
 
       function makeSpoilerTable(summary, entries) {
         const isOpen = openSummaries.includes(summary);
         return `<details${isOpen ? " open" : ""} style="margin-top:10px;">
 <summary style="cursor:pointer;">${summary}</summary>
 <div class="spoiler">
   ${makeTable("", entries)}
 </div>
 </details>`;
       }
 
       let html = "";
 
       if (temps.length > 0) html += makeTable("🌡️ CPU Temperature (Average / Max)", temps);
       if (tempsCores.length > 0) html += makeSpoilerTable("🌡️ CPU Temperature per Core", tempsCores);
 
       if (loads.length > 0) html += makeTable("⚙️ CPU Load (Total / Max)", loads);
       if (loadsCores.length > 0) {
         const sorted = loadsCores.sort((a, b) => {
           const aNum = parseInt(a.text.match(/\d+/)?.[0] || "0");
           const bNum = parseInt(b.text.match(/\d+/)?.[0] || "0");
           return aNum - bNum;
         });
         html += makeSpoilerTable("⚙️ CPU Load per Core", sorted);
       }
 
       if (mems.length > 0) html += makeTable("🝙 RAM Memory", mems);
 
       if (disks.length > 0) {
         disks.forEach(disk => {
           const entries = disk.entries.map(e => ({
             text: e.label,
             value: e.value,
             min: e.min,
             max: e.max
           }));
           html += makeTable(`💾 Storage: ${disk.disk} (${disk.type || "?"})`, entries);
         });
       }
 
       if (gpus.length > 0) {
         gpus.forEach(gpu => {
           const rows = [];
           ["D3D 3D", "D3D Copy", "D3D Video Decode", "D3D Video Encode", "D3D Video Processing"].forEach(key => {
             if (gpu.loads[key]) {
               gpu.loads[key].forEach(entry => {
                 rows.push({
                   text: key,
                   value: entry.value,
                   min: entry.min,
                   max: entry.max
                 });
               });
             }
           });
           if (rows.length > 0) html += makeTable(`🎮 GPU: ${gpu.name}`, rows);
         });
       }
 
       document.getElementById("monitor-menu").innerHTML = html;
 
       // 🟡 Update summary value (Core Avg, CPU Total, Memory Used)
       const summarySpan = document.querySelector("#monitor-menu-button span");
       if (summarySpan) {
         summarySpan.textContent = `🌡️ ${coreAverageVal || "?"} ⚙️ ${cpuTotalVal || "?"}`;
         //summarySpan.textContent = `🌡️ ${coreAverageVal || "?"} | ⚙️ ${cpuTotalVal || "?"} | 🝙 ${memUsedVal || "?"}`;
       }
     })
     .catch(err => {
       console.log(`❌ JSON error: ${err.message}`);
     });
 }
 
 setInterval(fetchAndLog, 1000);
