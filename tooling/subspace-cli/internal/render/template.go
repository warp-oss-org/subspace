package render

import (
	"bytes"
	"fmt"
	"text/template"
)

type TemplateData map[string]string

func RenderTemplate(src []byte, data TemplateData) ([]byte, error) {
	tpl, err := template.New("file").Option("missingkey=error").Parse(string(src))
	if err != nil {
		return nil, fmt.Errorf("parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}

	return buf.Bytes(), nil
}
