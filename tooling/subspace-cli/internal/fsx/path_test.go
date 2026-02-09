package fsx

import "testing"

func TestValidateRelativePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		in      string
		wantErr bool
	}{
		{"empty", "", true},
		{"spaces", "   ", true},
		{"dot", ".", true},
		{"dotdot", "..", true},
		{"escape", "../x", true},
		{"escapeNested", "a/../../b", true},
		{"okSimple", "kv", false},
		{"okNested", "kv/adapters/redis", false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := ValidateRelativePath(tt.in)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected nil, got %v", err)
			}
		})
	}
}
