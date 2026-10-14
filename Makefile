UUID = zabbix-monitor@loginone
EXTRA_SOURCES = --extra-source=zabbixApi.js --extra-source=indicator.js --extra-source=stylesheet.css --extra-source=LICENSE --schema=schemas/org.gnome.shell.extensions.zabbix-monitor.gschema.xml

.PHONY: all compile-schemas install pack clean

all: compile-schemas

compile-schemas:
	glib-compile-schemas schemas/

install: compile-schemas
	./install.sh

pack: compile-schemas
	gnome-extensions pack --force $(EXTRA_SOURCES) .

clean:
	rm -f $(UUID).shell-extension.zip
