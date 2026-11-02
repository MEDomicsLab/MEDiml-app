//go:build !windows

package src

import (
	"os/exec"
	"syscall"
)

// setProcessGroup starts the process in its own process group, which then contains the processes it starts
func setProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// killProcessTree stops the process and all the processes it started (its process group)
func killProcessTree(cmd *exec.Cmd) error {
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
}
