import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand(
		'mission-control-flight-analyst.helloWorld',
		async () => {
		
			const panel = vscode.window.createWebviewPanel( 
				'missionControl',
				'Mission Control',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);
			panel.webview.html = getWebviewContent();
			
			panel.webview.onDidReceiveMessage(
				async message => {
					if(message.command === 'loadCSV') {
						const mode = message.mode;
						const fileUri = await vscode.window.showOpenDialog({
							canSelectMany: false,
							filters: { 'CSV Files': ['csv'] }	
						});

						if (fileUri && fileUri[0]) {
							const fileData = await vscode.workspace.fs.readFile(fileUri[0]);
							const csvText = Buffer.from(fileData).toString('utf8');
							
							let analysis;

							if (mode === 'rocket') {	
								analysis = analyzeRocketCSV(csvText);
							} else {
								analysis = analyzeDroneCSV(csvText);	
							}

							panel.webview.postMessage({
								command: 'analysisResult',
								data: analysis,
								mode: mode
							});
							
						}
				    
					}
				},
				undefined,
				context.subscriptions
			);
		}
	);		
	context.subscriptions.push(disposable);
}
export function deactivate() {}


//Rocket CSV Analysis
function analyzeRocketCSV(csvText: string) {
	const lines = csvText.trim().split("\n");
	const headers = lines[0].split(',');
	const altitudeIndex = headers.indexOf('altitude');
	const velocityIndex = headers.indexOf('velocity');
	const accelerationIndex = headers.indexOf('acceleration');

	let maxAltitude = 0;
	let maxVelocity = 0;
	let maxAcceleration = 0;

	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(',');

		const altitude = parseFloat(cols[altitudeIndex]);
		const velocity = parseFloat(cols[velocityIndex]);
		const acceleration = parseFloat(cols[accelerationIndex]);

		if (altitude > maxAltitude) {maxAltitude = altitude;}
		
		if (velocity > maxVelocity) {maxVelocity = velocity;}
		
		if (acceleration > maxAcceleration) {maxAcceleration = acceleration;}
		
	}

	return {
		maxAltitude,
		maxVelocity,
		maxAcceleration: maxAcceleration / 9.81 
   
	};
}																									


//Drone CSV Analysis
function analyzeDroneCSV(csvText: string) {

	const lines = csvText.trim().split("\n");
	const headers = lines[0].split(',');

	const rollIndex = headers.indexOf('roll');
	const pitchIndex = headers.indexOf('pitch');
	const yawIndex = headers.indexOf('yaw');	
	
	let maxRoll = 0;
	let maxPitch = 0;
	let maxYaw = 0;

	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(',');

		const roll = Math.abs(parseFloat(cols[rollIndex]));
		const pitch = Math.abs(parseFloat(cols[pitchIndex]));
		const yaw = Math.abs(parseFloat(cols[yawIndex]));

		if (roll > maxRoll) {maxRoll = roll;}
		if (pitch > maxPitch) {maxPitch = pitch;}
		if (yaw > maxYaw) {maxYaw = yaw;}

	}

	return {
		maxRoll,
		maxPitch,
		maxYaw,
		stabilityScore: 100 - (maxRoll + maxPitch) * 0.5
	
	};
}

//UI

function getWebviewContent(): string {
	return `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body {
					background-color: #0b0f19;
					color: #00ffcc;
					font-family: monospace;
					padding: 20px;
				}
				select, button {
					background-color: #00ffcc;
					border: none;
					padding: 8px 12px;
					cursor: pointer;
					font-weight: bold;}
				#status {
					margin-top: 20px;
					padding: 10px;
					background: #222;
					border-radius: 6px;
					}
				h1 {
					color: #00ffff;
				}
				.card {
					border: 1px solid #00ffcc;
					padding: 10px;
					margin-top: 15px;
				}
			</style>
		</head>
		<body>
			<h1>Mission Control Online</h1>
			<p>Flight telemetry systems standing by...</p>

			<label>Mode:</label>
			<select id="mode">
				<option value="rocket">Rocket</option>
				<option value="drone">Drone</option>
			</select>
			
			<br/>
			<button onclick="loadCSV()">Load CSV</button>

			<div id="status">
				No file loaded.
			</div>
			
			<div class="card" id="summaryCard">
				<h2>Flight Summary</h2>
				<p>Status: Awaiting Data</p>
			</div>

			<script>
				const vscode = acquireVsCodeApi();
				
				function loadCSV() {
					const selectedMode = document.getElementById('mode').value;
				
					vscode.postMessage({ 
						command: 'loadCSV',
						mode: selectedMode
					});
				}
				window.addEventListener('message', event => {

					const message = event.data;

					if (message.command === 'analysisResult') {

						const data = message.data;
						const mode= message.mode;

						document.getElementById('status').textContent = "Analsysis Complete";

						if (mode === "rocket") {	
						
							document.getElementById('summaryCard').innerHTML = \`
								<h2>Rocket Flight Summary</h2>
								<p>Max Altitude: \${data.maxAltitude.toFixed(2)} m</p>
								<p>MaxVelocity: \${data.maxVelocity.toFixed(2)} m/s</p>
            	               <p>Max Acceleration: \${data.maxAcceleration.toFixed(2)} G</p>
						    \`;
						} else {
							document.getElementById('summaryCard').innerHTML = \`
								<h2>Drone Flight Summary</h2>
								<p>Max Roll: \${data.maxRoll.toFixed(2)} degrees</p>
								<p>Max Pitch: \${data.maxPitch.toFixed(2)} degrees</p>
								<p>Max Yaw: \${data.maxYaw.toFixed(2)} degrees</p>
								<p>Stability Score: \${data.stabilityScore.toFixed(1)}</p>
						    \`;
						}
				 	
					}
				});
			</script>
		</body>
		</html>
	`;
}
