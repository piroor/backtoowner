load('lib/config.html');

const PREFROOT = 'extensions.backtoowner@piro.sakura.ne.jp.';

config.setDefault(PREFROOT+'shouldCloseTab', false);
config.setDefault(PREFROOT+'shouldCloseTree', false);

var bundle = require('lib/locale')
				.get(location.href.replace(/[^\/]+$/, '')+
						'locale/config.properties');

config.register('resource://backtoowner/modules/lib/config.html', <>

<prefwindow id="backtoowner-config"
	xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
	title={bundle.getString('title')}>

	<prefpane id="prefpane-general" label="general">
		<preferences>
			<preference id="shouldCloseTab"
				name="extensions.backtoowner@piro.sakura.ne.jp.shouldCloseTab"
				type="bool"/>
			<preference id="shouldCloseTree"
				name="extensions.backtoowner@piro.sakura.ne.jp.shouldCloseTree"
				type="bool"/>
		</preferences>


		<checkbox id="shouldCloseTab-checkbox"
			label={bundle.getString('shouldCloseTab')}
			preference="shouldCloseTab"/>
		<checkbox id="shouldCloseTree-checkbox"
			label={bundle.getString('shouldCloseTree')}
			preference="shouldCloseTree"/>

	</prefpane>

</prefwindow>

</>.toXMLString());
