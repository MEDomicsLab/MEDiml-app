package main

import (
	"encoding/json"
	"fmt"
	ExtractionMEDiml "go_module/blueprints/extractionMEDiml"
	LearningMEDiml "go_module/blueprints/learningMEDiml"
	PocData "go_module/blueprints/pocData"
	Utils "go_module/src"
	"log"
	"net/http"
	"os"

	"github.com/rs/cors"
)

func main() {

	// Here is where you add the handle functions to the server
	LearningMEDiml.AddHandleFunc()
	ExtractionMEDiml.AddHandleFunc()
	PocData.AddHandleFunc()
	Utils.CreateHandleFunc("get_server_health", handleGetServerHealth)
	Utils.CreateHandleFunc("removeId/", handleRemoveId)
	Utils.CreateHandleFunc("stop/", handleStop)
	Utils.CreateHandleFunc("clearAll", handleClearAll)

	// We check if the conda environment was passed as an argument
	condaEnv := os.Getenv("MED_ENV")
	log.Println("Number of arguments: " + fmt.Sprint(len(os.Args)))
	for i := 0; i < len(os.Args); i++ {
		log.Println("Argument " + fmt.Sprint(i) + ": " + os.Args[i])
	}

	if len(os.Args) == 6 {
		condaEnv = os.Args[5]
	}

	log.Println("Conda env: " + condaEnv)
	os.Setenv("MED_ENV", condaEnv)
	os.Setenv("MED_TMP", os.Args[4])
	// Here is where you start the server
	c := cors.Default()
	handler := c.Handler(http.DefaultServeMux)
	port := os.Args[1]
	log.Println("Server is listening on :" + port + "...")
	err := http.ListenAndServe(":"+port, handler)
	if err != nil {
		log.Println("Error starting server: ", err)
		return
	}

}

// handleGetServerHealth handles the request to get the server health
func handleGetServerHealth(jsonConfig string, id string) (string, error) {
	Utils.Mu.Lock()
	states := Utils.Scripts
	Utils.Mu.Unlock()
	data := make(map[string]string)
	for key, value := range states {
		data[key], _ = convScript2JsonStr(value)
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	// check number of keys in map
	numKeys := len(states)
	log.Printf("Server health: %d active processes", numKeys)
	return string(jsonData), nil
}

// convScript2JsonStr converts the script info to json string
func convScript2JsonStr(script Utils.ScriptInfo) (string, error) {
	data := make(map[string]string)
	//data["info"] = script.Cmd.String()
	data["progress"] = script.Progress
	jsonData, _ := Utils.Map2jsonStr(data)
	return jsonData, nil
}

// handleRemoveId handles the request to remove the id from the scripts
func handleRemoveId(jsonConfig string, id string) (string, error) {
	ok := Utils.KillScript(id)
	Utils.RemoveIdFromScripts(id)
	return "Removed successfully state : " + fmt.Sprint(ok), nil
}

// handleStop handles the request to stop the running script with the id (e.g. a learning experiment).
// The id is kept: the request that started the script is then answered with {"cancelled": true}
func handleStop(jsonConfig string, id string) (string, error) {
	stopped := Utils.KillScript(id)
	return "{\"stopped\": " + fmt.Sprint(stopped) + "}", nil
}

// handleClearAll handles the request to clear all the scripts
func handleClearAll(jsonConfig string, id string) (string, error) {
	Utils.ClearAllScripts()
	return "Removed all states successfully", nil
}
