package main

import (
	"io/fs"
	"log"

	"github.com/warp-oss-org/subspace/tooling/subspace-cli/cmd"
)

func main() {
	sub, err := fs.Sub(embeddedRegistry, "registry")
	if err != nil {
		log.Fatalf("open embedded registry: %v", err)
	}

	cmd.Execute(sub)
}
