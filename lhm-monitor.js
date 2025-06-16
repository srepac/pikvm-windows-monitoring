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

      let pcNameVal = "";
      let mainboardNameVal = "";
      let cpuNameVal = "";
      let coreAverageVal = "";
      let cpuCoresVal = "";
      let cpuTotalVal = "";
      let memUsedVal = "";
		
      function extractGpuInfo(node, gpuName, memoryFallback) {
        if (!node || typeof node !== "object") return;

        const text = node.Text || "";
        const type = node.Type || "";
        const value = node.Value || "";
        const min = node.Min || "";
        const max = node.Max || "";

        const gpu = gpus.find(g => g.name === gpuName);
        const keys = ["D3D 3D", "D3D Copy", "D3D Video Decode", "D3D Video Encode", "D3D Video Processing"];

        // Load
        if (type === "Load" && keys.some(k => text.startsWith(k))) {
          const key = keys.find(k => text.startsWith(k));
          if (gpu) {
            gpu.loads[key] = gpu.loads[key] || [];
            gpu.loads[key].push({ value, min, max });
          }
        }

        // Memory (GPU)
        const memoryKeys = ["GPU Memory Used", "GPU Memory Free", "GPU Memory Total"];
		const fallbackKeys = ["D3D Shared Memory Used", "D3D Shared Memory Free", "D3D Shared Memory Total"];

		if (memoryKeys.includes(text)) {
		  memoryFallback.push({ text, value, min, max });
		  memoryFallback.__hasPrimary__ = true;
		} else if (fallbackKeys.includes(text)) {
		  if (!memoryFallback.__hasPrimary__) {
			memoryFallback.push({ text, value, min, max });
		  }
		}

        if (Array.isArray(node.Children)) {
          node.Children.forEach(child => extractGpuInfo(child, gpuName, memoryFallback));
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
		
		if (image === "images_icon/computer.png") {
			pcNameVal = text;
		}
		if (image === "images_icon/mainboard.png") {
			mainboardNameVal = text;
		}
		if (image === "images_icon/cpu.png") {
			cpuNameVal = text;
		}
        // 🌡️ CPU temperature
        if (type === "Temperature") {
          if (/Core (Max|Average)/.test(text)) {
            const entry = { text, value, min, max };
            if (text === "Core Average") {
              temps.unshift(entry); // insert Core Average at the beginning
              coreAverageVal = value;
            } else {
              temps.push(entry);
            }
          } else if (/^CPU Core #\d+$/.test(text)) {
            tempsCores.push({ text, value, min, max });
          } else if (/CPU Cores/.test(text)) {
			temps.unshift({ text, value, min, max });
            cpuCoresVal = value;
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
          const gpu = { name: gpuName, loads: {}, memory: [] };
          gpus.push(gpu);
          node.Children.forEach(child => extractGpuInfo(child, gpuName, gpu.memory));
        }

        if (Array.isArray(node.Children)) {
          node.Children.forEach(child => traverse(child, parentDisk));
        }
      }

      traverse(data);
	  
      // 🔍 Preserve open <details> blocks
      const openSummaries = Array.from(document.querySelectorAll("#monitor-menu details[open] > summary"))
        .map(summary => summary.textContent.trim());

    function makeTable(title, entries, headers = ["Name", "Current", "Min", "Max"]) {
	  let html = makeTitle(title);
	  html += `<table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-family:'Segoe UI',sans-serif; font-size:14px; background-color:#1e1e1e; color:#f0f0f0; border:1px solid #333;">`;
	  html += `<thead><tr>${headers.map(h =>
		`<th style="background-color:#2d2d2d; color:#ffffff; text-align:left; padding:8px 12px; border-bottom:1px solid #333;">${h}</th>`
	  ).join("")}</tr></thead><tbody>`;
	  entries.forEach(e => {
		html += `<tr style="border-bottom:1px solid #333;">` +
		  `<td style="padding:8px 12px; border-bottom:1px solid #333;font-weight: bold;">${e.text}</td>` +
		  `<td style="padding:8px 12px; border-bottom:1px solid #333; color:#1abc9c;font-weight: bold;">${e.value}</td>` +
		  `<td style="padding:8px 12px; border-bottom:1px solid #333; color:#f39c12;">${e.min}</td>` +
		  `<td style="padding:8px 12px; border-bottom:1px solid #333; color:#e74c3c;">${e.max}</td>` +
		`</tr>`;
	  });
	  html += `</tbody></table>`;
	  return html;
	}
	
	function makeInfos(title, pcName, mainboardName,cpuName) {
		headers = ["Component", "Name"]
		headers = ["Component", "Name"]
		<!-- headerPC = "PC"; -->
		<!-- headerMain = "Mainboard"; -->
		<!-- headers = []; -->
		<!-- if (pcName.length > 0) { -->
			<!-- headers.push(headerPC); -->
		<!-- } -->
		<!-- if (mainboardName.length > 0) { -->
			<!-- headers.push(headerMain); -->
		<!-- } -->
		let html = '';
		html = makeTitle(title);
		html += `<table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-family:'Segoe UI',sans-serif; font-size:14px; background-color:#1e1e1e; color:#f0f0f0; border:1px solid #333;">`;
		html += `<thead><tr>${headers.map(h =>
		`<th style="background-color:#2d2d2d; color:#ffffff; text-align:left; padding:8px 12px; border-bottom:1px solid #333;">${h}</th>`
		).join("")}</tr></thead><tbody>`;
		if (pcName.length > 0) {
			html += `<tr style="border-bottom:1px solid #333;">`;
			html += `<td style="padding:8px 12px; border-bottom:1px solid #333;font-weight: bold;">Computer</td>`;
			html += `<td style="padding:8px 12px; border-bottom:1px solid #333;color: #00d9ff;font-weight: bold;">${pcName}</td>`;
			html += `</tr>`;
		}
		if (mainboardName.length > 0) {
			html += `<tr style="border-bottom:1px solid #333;">`;
			html += `<td style="padding:8px 12px; border-bottom:1px solid #333;font-weight: bold;">Mainboard</td>`;
			html += `<td style="padding:8px 12px; border-bottom:1px solid #333;color: #00d9ff;font-weight: bold;">${mainboardName}</td>`;
			html += `</tr>`;
		}
		if (cpuName.length > 0) {
			html += `<tr style="border-bottom:1px solid #333;">`;
			html += `<td style="padding:8px 12px; border-bottom:1px solid #333;font-weight: bold;">CPU</td>`;
			html += `<td style="padding:8px 12px; border-bottom:1px solid #333;color: #00d9ff;font-weight: bold;">${cpuName}</td>`;
			html += `</tr>`;
		}
		html += `</tbody></table>`;

	 
	  console.log(html);
	  return html;
	}
	
	function makeTitle(title) {
	  let html = `<h3 style="margin-top:10px; color:#f0f0f0; font-family:'Segoe UI',sans-serif;">${title}</h3>`;
	  return html;
	}

    function makeSpoilerTable(summary, entries) {
	  const isOpen = openSummaries.includes(summary);
	  return `<details${isOpen ? " open" : ""} style="margin-top:10px; color:#f0f0f0;">
	<summary style="cursor:pointer; padding:4px 0; font-weight:bold;">${summary}</summary>
	<div class="spoiler">
	  ${makeTable("", entries)}
	</div>
	</details>`;
	}
    function makeButtonTable(temp, load) {
	  let html = '';
	  html += `<table style="border-collapse: collapse;font-weight: bold;margin-top: 8px;display: flex;">`;
	  html += `<tbody><tr>`;
	  html += `<td style="padding-right: 2px;line-height: 18px;text-align: center;">🌡️</td>`;
	  html += `<td style="line-height: 18px;text-align: center;">${temp}</td>`;
	  html += `</tr>`;
	  html += `<tr>`;
	  html += `<td style="padding-right: 2px;line-height: 18px;text-align: center;">⚙️</td>`;
	  html += `<td style="line-height: 18px;text-align: center;">${load}</td>`;
	  html += `</tr>`;
	  html += `</tbody></table>`;
	  return html;
	}

      let html = "";
      html += makeInfos("💻 Computer Infos", pcNameVal, mainboardNameVal, cpuNameVal);
      if (temps.length > 0) html += makeTable("🌡️ CPU Temperature", temps);
      if (tempsCores.length > 0) html += makeSpoilerTable("🌡️ CPU Temperature per Core", tempsCores);

      if (loads.length > 0) html += makeTable("⚙️ CPU Load", loads);
      if (loadsCores.length > 0) {
        const sorted = loadsCores.sort((a, b) => {
          const aNum = parseInt(a.text.match(/\d+/)?.[0] || "0");
          const bNum = parseInt(b.text.match(/\d+/)?.[0] || "0");
          return aNum - bNum;
        });
        html += makeSpoilerTable("⚙️ CPU Load per Core", sorted);
      }

      if (mems.length > 0) html += makeTable("<span style='position:relative; top:-3px;'>🝙</span> RAM Memory", mems);

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
          const rows = [...gpu.memory];
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
	  summarySpan.style.fontWeight = "bold";
      if (summarySpan) {
        summarySpan.innerHTML = makeButtonTable(coreAverageVal || cpuCoresVal || "?", cpuTotalVal || "?");
        // summarySpan.textContent = `🌡️ ${coreAverageVal || cpuCoresVal || "?"} ⚙️ ${cpuTotalVal || "?"}`;
		//summarySpan.textContent = `🌡️ ${coreAverageVal || cpuCoresVal || "?"} | ⚙️ ${cpuTotalVal || "?"} | <span style='position:relative; top:-3px;'>🝙</span> ${memUsedVal || "?"}`;
      }
    })
    .catch(err => {
      console.log(`❌ JSON error: ${err.message}`);
    });
}

 setInterval(fetchAndLog, 1000);

