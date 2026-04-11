package buildinfo

import "runtime/debug"

var (
	ReleaseVersion = "dev"
	ReleaseCommit  = ""
)

func Version() string {
	if ReleaseVersion != "" && ReleaseVersion != "dev" {
		return ReleaseVersion
	}

	if info, ok := debug.ReadBuildInfo(); ok {
		if info.Main.Version != "" && info.Main.Version != "(devel)" {
			return info.Main.Version
		}
	}

	return "dev"
}

func Commit() string {
	if ReleaseCommit != "" {
		return ReleaseCommit
	}

	if info, ok := debug.ReadBuildInfo(); ok {
		for _, setting := range info.Settings {
			if setting.Key == "vcs.revision" && setting.Value != "" {
				return setting.Value
			}
		}
	}

	return "unknown"
}
