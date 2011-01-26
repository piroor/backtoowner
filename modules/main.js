load('lib/WindowManager');
load('backtoowner');

const TYPE_BROWSER = 'navigator:browser';

function handleWindow(aWindow)
{
	if (aWindow.document.documentElement.getAttribute('windowtype') == TYPE_BROWSER &&
		!aWindow.backToOwner)
		aWindow.backToOwner = new BackToOwner(aWindow);
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown()
{
	WindowManager.getWindows(TYPE_BROWSER).forEach(function(aWindow) {
		if (aWindow.backToOwner) {
			aWindow.backToOwner.destroy();
			delete aWindow.backToOwner;
		}
	});

	WindowManager = void(0);
	BackToOwner = void(0);
}

