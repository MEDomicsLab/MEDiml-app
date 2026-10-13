//go:build windows

package src

import (
	"os/exec"
	"strconv"
	"syscall"
)

// setProcessGroup does nothing on Windows: taskkill /T finds the child processes from the parent
func setProcessGroup(cmd *exec.Cmd) {}

// killProcessTree stops the process and all the processes it started
func killProcessTree(cmd *exec.Cmd) error {
	kill := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(cmd.Process.Pid))
	kill.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return kill.Run()
}
