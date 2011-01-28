var config = require('lib/config');

const PREFROOT = 'extensions.backtoowner@piro.sakura.ne.jp.';

config.setDefault(PREFROOT+'shouldCloseTab', false);
config.setDefault(PREFROOT+'shouldCloseTree', false);

var bundle = require('lib/locale')
				.get(resolve('locale/config.properties'));

config.register('resource://backtoowner/config', <>

<prefwindow id="backtoowner-config"
	xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
	title={bundle.getString('title')}>

	<prefpane id="prefpane-general" label={bundle.getString('general')}>
		<preferences>
			<preference id="shouldCloseTab"
				name={PREFROOT+'shouldCloseTab'}
				type="bool"/>
			<preference id="shouldCloseTree"
				name={PREFROOT+'shouldCloseTree'}
				type="bool"/>
		</preferences>


		<checkbox id="shouldCloseTab-checkbox"
			label={bundle.getString('shouldCloseTab')}
			preference="shouldCloseTab"/>
		<hbox align="center">
			<spacer style="width:1em;"/>
			<checkbox id="shouldCloseTree-checkbox"
				label={bundle.getString('shouldCloseTree')}
				preference="shouldCloseTree"/>
		</hbox>

	</prefpane>

</prefwindow>

</>);
