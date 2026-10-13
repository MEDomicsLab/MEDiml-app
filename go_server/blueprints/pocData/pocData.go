package pocData

import (
	Utils "go_module/src"
	"log"
)

var prePath = "poc_data"

// AddHandleFunc adds the specific module handle function to the server
func AddHandleFunc() {
	Utils.CreateHandleFunc(prePath+"/download/", handleDownload)
	Utils.CreateHandleFunc(prePath+"/progress/", handleProgress)
}

// handleDownload handles the request to download the proof-of-concept data from Zenodo
// It returns the response from the python script
func handleDownload(jsonConfig string, id string) (string, error) {
	log.Println("Downloading POC data", id)
	response, err := Utils.StartPythonScripts(jsonConfig, "../pythonCode/modules/poc_data/download_sts_poc.py", id)
	if err != nil {
		return "", err
	}
	return response, nil
}

// handleProgress handles the request to get the progress of the download
// It returns the progress of the download
func handleProgress(jsonConfig string, id string) (string, error) {
	Utils.Mu.Lock()
	progress := Utils.Scripts[id].Progress
	Utils.Mu.Unlock()
	if progress != "" {
		return progress, nil
	} else {
		return "{\"now\":\"0\", \"currentLabel\":\"Warming up\"}", nil
	}
}
