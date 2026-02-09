package main

import "embed"

// registry/ is relative to this file — lives at tooling/subspace-cli/registry/
//
//go:embed registry/**
var embeddedRegistry embed.FS
