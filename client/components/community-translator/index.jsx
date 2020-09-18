/**
 * External dependencies
 */
import React from 'react';
import i18n, { localize } from 'i18n-calypso';
import { useI18n } from '@automattic/react-i18n';
import debugModule from 'debug';
import { isEmpty } from 'lodash';
/**
 * Internal dependencies
 */
import Translatable from './translatable';
import { getLanguage } from 'lib/i18n-utils';
import userSettings from 'lib/user-settings';
import { isCommunityTranslatorEnabled } from 'components/community-translator/utils';

/**
 * Style dependencies
 */
import './style.scss';

/**
 * Local variables
 */
const debug = debugModule( 'calypso:community-translator' );

function useLocaleData() {
	const [ localeData, setLocaleData ] = React.useState( i18n.getLocale() || { '': {} } );
	const { localeSlug, localeVariant } = localeData[ '' ];
	const localeCode = localeVariant || localeSlug;
	const currentLocale = getLanguage( localeCode );

	return {
		localeData,
		localeCode,
		currentLocale,
		setLocaleData: () => setLocaleData( Object.assign( {}, i18n.getLocale() ) || { '': {} } ),
	};
}

function CommunityTranslator() {
	const [ initialized, setInitialized ] = React.useState( false );
	const reactI18n = useI18n();
	const { localeData, localeCode, currentLocale, setLocaleData } = useLocaleData();
	const refresh = React.useCallback( () => {
		if ( initialized ) {
			return;
		}

		if ( ! userSettings.getSettings() ) {
			debug( 'initialization failed because userSettings are not ready' );
			return;
		}

		if ( ! isCommunityTranslatorEnabled() ) {
			debug( 'not initializing, not enabled' );
			return;
		}

		setLocaleData();

		if ( ! localeCode || ! localeData ) {
			debug( 'trying to initialize translator without loaded language' );
			return;
		}

		debug( 'Successfully initialized' );
		setInitialized( true );
	}, [ setInitialized ] );

	/**
	 * Wraps translation in a DOM object and attaches `toString()` method in case in can't be rendered
	 *
	 * @param {string} originalFromPage - original string
	 * @param {string} displayedTranslationFromPage - translated string
	 * @param  {object} optionsFromPage - i18n.translate options
	 * @returns {object} DOM object
	 */
	function wrapTranslation( originalFromPage, displayedTranslationFromPage, optionsFromPage ) {
		if ( ! isCommunityTranslatorEnabled() ) {
			return displayedTranslationFromPage;
		}

		if ( 'object' !== typeof optionsFromPage ) {
			optionsFromPage = {};
		}

		if ( 'string' !== typeof originalFromPage ) {
			debug( 'unknown original format' );
			return displayedTranslationFromPage;
		}

		if ( optionsFromPage.textOnly ) {
			debug( `respecting textOnly for string "${ originalFromPage }"` );
			return displayedTranslationFromPage;
		}

		const props = {
			singular: originalFromPage,
			locale: currentLocale,
		};

		let key = originalFromPage;

		// Has Context
		if ( 'string' === typeof optionsFromPage.context ) {
			props.context = optionsFromPage.context;

			// see how Jed defines \u0004 as the delimiter here: https://messageformat.github.io/Jed/
			key = `${ optionsFromPage.context }\u0004${ originalFromPage }`;
		}

		// Has Plural
		if ( 'string' === typeof optionsFromPage.plural ) {
			props.plural = optionsFromPage.plural;
		}

		// Has no translation in current locale
		// Must be a string to be a valid DOM attribute value
		if ( isEmpty( localeData[ key ] ) ) {
			props.untranslated = 'true';
		}

		// <Translatable> returns a frozen object, therefore we make a copy so that we can modify it below
		const translatableElement = Object.assign(
			{},
			<Translatable { ...props }>{ displayedTranslationFromPage }</Translatable>
		);

		// now we can override the toString function which would otherwise return [object Object]
		translatableElement.toString = () => {
			// here we can store the strings that cannot be rendered to the page
			return displayedTranslationFromPage;
		};

		// freeze the object again to certify the same behavior as the original ReactElement object
		Object.freeze( translatableElement );

		return translatableElement;
	}

	React.useEffect( () => {
		// wrap translations from i18n-calypso
		const translateHook = ( translation, options ) =>
			wrapTranslation( options.original, translation, options );
		i18n.registerTranslateHook( translateHook );

		// wrap translations from @automattic/react-i18n
		reactI18n.addFilter( 'translation', 'community-translator', ( translation, args, fnName ) => {
			const options = {
				original: args[ 0 ],
			};

			if ( fnName === '_n' || fnName === '_nx' ) {
				options.plural = args[ 1 ];
			}

			if ( fnName === '_x' ) {
				options.context = args[ 1 ];
			} else if ( fnName === '_nx' ) {
				options.context = args[ 3 ];
			}

			return wrapTranslation( options.original, translation, options );
		} );

		i18n.on( 'change', refresh );
		userSettings.on( 'change', refresh );

		return () => {
			i18n.translateHooks = i18n.translateHooks.filter( ( hook ) => hook !== translateHook );
			reactI18n.removeFilter( 'translation', 'community-translator' );
			i18n.off( 'change', refresh );
			userSettings.removeListener( 'change', refresh );
		};
	}, [ localeData, initialized ] );

	return null;
}

export default localize( CommunityTranslator );
