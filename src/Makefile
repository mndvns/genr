
{{#if tests}}test:
	@{{#if debug}}DEBUG={{name}}* {{/if}}mocha \
	  --watch \
	  --bail{{/if}}

.PHONY: {{#if tests}}test{{/if}}
