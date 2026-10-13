cd go_server
go build main.go
cd ..
echo F | cp -p go_server/main renderer/public/server_go_mac
echo F | cp -p go_server/main go_executables/server_go_mac
chmod +x go_executables/server_go_mac

# Recent macOS versions refuse to run binaries without the LC_UUID load command ("dyld: missing LC_UUID
# load command"), which the Go linker only writes since Go 1.24: stop the build instead of shipping a broken server
if command -v otool >/dev/null 2>&1; then
  if ! otool -l go_executables/server_go_mac | grep -q LC_UUID; then
    echo "ERROR: go_executables/server_go_mac has no LC_UUID load command, build it with Go >= 1.24 ($(go version))" >&2
    exit 1
  fi
fi
