package main

import "embed"

// packages/ is relative to this file.
//
//go:embed packages/**
var embeddedRegistry embed.FS
