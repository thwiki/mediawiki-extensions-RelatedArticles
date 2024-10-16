// eslint-disable-next-line spaced-comment
/// <reference path="../mw.ts" />

/**
 * @class RelatedPagesGateway
 * @param {MwApi} api
 * @param {string} currentPage the page that the editorCuratedPages relate to
 * @param {string[]|null} editorCuratedPages a list of pages curated by editors for the current page
 * @param {boolean} useCirrusSearch whether to hit the API when no editor-curated pages are available
 * @param {boolean} [onlyUseCirrusSearch=false] whether to ignore the list of editor-curated pages
 * @param {boolean|string} [descriptionSource=false] source to get the page description from
 */
function RelatedPagesGateway(
	api,
	currentPage,
	editorCuratedPages,
	useCirrusSearch,
	onlyUseCirrusSearch,
	descriptionSource
) {
	this.api = api;
	this.currentPage = currentPage;
	this.useCirrusSearch = useCirrusSearch;
	this.descriptionSource = descriptionSource;

	if ( onlyUseCirrusSearch ) {
		editorCuratedPages = [];
	}

	this.editorCuratedPages = editorCuratedPages || [];

}

/**
 * @ignore
 * @param {MwApiQueryResponse} result
 * @return {MwApiPageObject[]}}
 */
function getPages( result ) {
	return result && result.query && result.query.pages ? result.query.pages : [];
}

/**
 * Gets the related pages for the current page.
 *
 * If there are related pages assigned to this page using the `related`
 * parser function, then they are returned.
 *
 * If there aren't any related pages assigned to the page, then the
 * CirrusSearch extension's {@link https://www.mediawiki.org/wiki/Help:CirrusSearch#morelike: "morelike:" feature}
 * is used. If the CirrusSearch extension isn't installed, then the API
 * call will fail gracefully and no related pages will be returned.
 * Thus the dependency on the CirrusSearch extension is soft.
 *
 * Related pages will have the following information:
 *
 * * The ID of the page corresponding to the title
 * * The thumbnail, if any
 * * The page description, if any
 *
 * @method
 * @param {number} limit of pages to get. Should be between 1-20.
 * @return {JQuery.Promise<MwApiPageObject[]>}
 */
RelatedPagesGateway.prototype.getForCurrentPage = function ( limit ) {
	const parameters = /** @type {MwApiActionQuery} */ ( {
			action: 'query',
			formatversion: 2,
			origin: '*',
			prop: 'pageimages|pagedesc',
			piprop: 'thumbnail',
			pithumbsize: 160 // FIXME: Revert to 80 once pithumbmode is implemented
		} ),
		// Enforce limit
		relatedPages = this.editorCuratedPages.slice( 0, limit );

	if ( relatedPages.length ) {
		parameters.pilimit = relatedPages.length;
		parameters.continue = '';

		parameters.titles = relatedPages;
	} else if ( this.useCirrusSearch ) {
		parameters.pilimit = limit;

		parameters.generator = 'search';
		parameters.gsrsearch = 'morelike:' + this.currentPage;
		var namespaces = mw.config.get('wgContentNamespaces');
		parameters.gsrnamespace = namespaces == null ? '0' : namespaces.join(',');
		parameters.gsrlimit = limit;
		parameters.gsrqiprofile = 'classic_noboostlinks';

		// Currently, if you're logged in, then the API uses your language by default ard so responses
		// are always private i.e. they shouldn't be cached in a shared cache and can be cached by the
		// browser.
		//
		// By make the API use the language of the content rather than that of the user, the API
		// reponse is made public, i.e. they can be cached in a shared cache.
		//
		// See T97096 for more detail and discussion.
		parameters.uselang = 'content';

		// Instruct shared caches that the response will become stale in 24 hours.
		parameters.smaxage = 86400;

		// Instruct the browser that the response will become stale in 24 hours.
		parameters.maxage = 86400;
	} else {
		return $.Deferred().resolve( [] );
	}

	return this.api.get( parameters )
		.then( getPages );
};

module.exports = RelatedPagesGateway;
