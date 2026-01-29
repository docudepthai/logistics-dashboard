/**
 * Atlas-Powered Logistics Agent
 * Uses Atlas-1 for intent detection, comprehensive location parsing for everything else
 * NO GPT dependency - fully self-contained with feature parity
 */

import postgres from 'postgres';
import { parseIntent, type AtlasResponse } from './atlas-client.js';
import { Intent, getResponse } from './intents.js';
import { ConversationStore, type ConversationContext } from './conversation.js';
import { searchJobs, type SearchJobsParams, type JobResult } from './tools/searchJobs.js';
import { normalizeToAscii } from '@turkish-logistics/shared/utils';
import { getProvinceByName, getDistrictsByName, getNeighboringProvinces } from '@turkish-logistics/shared/constants';
import {
  parseLocationsFromMessage,
  hasFoulLanguage,
  preprocessMessage,
  INTERNATIONAL_DESTINATIONS,
  TURKISH_REGIONS,
  type ParsedLocations,
} from './location-parser.js';

export interface AtlasAgentOptions {
  sql: postgres.Sql;
  conversationsTable?: string;
}

export interface AtlasAgentResponse {
  message: string;
  jobIds: string[];
  context: ConversationContext;
  intent?: Intent;
}

export class AtlasAgent {
  private sql: postgres.Sql;
  private conversationStore: ConversationStore;

  constructor(options: AtlasAgentOptions) {
    this.sql = options.sql;
    this.conversationStore = new ConversationStore({ tableName: options.conversationsTable });
  }

  /**
   * Process a message using Atlas for intent detection
   */
  async processMessage(userId: string, userMessage: string): Promise<AtlasAgentResponse> {
    const startTime = Date.now();
    console.log(`[AtlasAgent] Processing message from ${userId}: "${userMessage}"`);

    // Get conversation context
    const conversation = await this.conversationStore.getConversation(userId);
    const existingContext = conversation?.context;

    // Preprocess message (trucker slang: "13 60" -> "tir")
    const processedMessage = preprocessMessage(userMessage);
    if (processedMessage !== userMessage) {
      console.log(`[AtlasAgent] Preprocessed: "${userMessage}" -> "${processedMessage}"`);
    }

    // Check for foul language first
    if (hasFoulLanguage(processedMessage)) {
      const response = 'abi kufur etme, duzgun konus. is mi bakiyorsun?';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return { message: response, jobIds: [], context: {} as ConversationContext };
    }

    // Check for farewell patterns
    const msg = normalizeToAscii(processedMessage.toLowerCase().trim());
    const farewellPatterns = ['bb', 'bay', 'bye', 'gorusuruz', 'hosca kal', 'hoscakal'];
    if (farewellPatterns.some(p => msg === p || msg.startsWith(p + ' '))) {
      const response = 'gorusuruz abi, kolay gelsin';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return { message: response, jobIds: [], context: {} as ConversationContext };
    }

    // Check for thank you patterns
    const thankPatterns = ['sagol', 'tesekkur', 'tesekkurler', 'eyv', 'eyvallah', 'saol'];
    if (thankPatterns.some(p => msg.includes(p))) {
      const response = 'rica ederim abi';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return { message: response, jobIds: [], context: {} as ConversationContext };
    }

    // Check for ambiguous phrases that shouldn't trigger searches
    const ambiguousPhrases = ['tum isler', 'tum isleri', 'butun isler', 'hepsini goster', 'takip et', 'takip', 'peki'];
    if (ambiguousPhrases.some(p => msg === p || msg === p.replace(/ /g, ''))) {
      // Check if we have context to show more results
      if (existingContext?.lastOrigin && existingContext?.lastTotalCount && existingContext.lastTotalCount > (existingContext.lastShownCount || 0)) {
        // User wants more results from last search - treat as pagination
        const paginationResult = await this.handlePagination(userId, existingContext);
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: paginationResult.response }, paginationResult.contextUpdate);
        return { message: paginationResult.response, jobIds: paginationResult.jobIds, context: { ...existingContext, ...paginationResult.contextUpdate } as ConversationContext };
      } else if (existingContext?.lastOrigin) {
        // We have context but no more results
        const response = `${existingContext.lastOrigin}${existingContext.lastDestination ? ' ' + existingContext.lastDestination : ''} icin daha fazla yuk yok abi. baska rota dene?`;
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return { message: response, jobIds: [], context: existingContext };
      } else {
        // No context at all - ask for route
        const response = 'nerden nereye bakmami istersin? ornek: istanbul ankara';
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return { message: response, jobIds: [], context: {} as ConversationContext };
      }
    }

    // Check for confirmation (vehicle/nearby suggestion flows)
    const confirmPatterns = ['evet', 'olur', 'tamam', 'ok', 'oke', 'yes', 'olsun', 'bak', 'bakabilirsin'];
    const isConfirmation = confirmPatterns.some(p => msg === p || msg.startsWith(p + ' '));

    // Handle vehicle suggestion confirmation
    if (isConfirmation && existingContext?.pendingVehicleSuggestion && existingContext?.preferredVehicle) {
      return this.handleVehicleSuggestionConfirm(userId, existingContext);
    }

    // Handle nearby search confirmation
    if (isConfirmation && existingContext?.pendingNearbySuggestion) {
      return this.handleNearbySuggestionConfirm(userId, existingContext);
    }

    // Parse locations from message (comprehensive Turkish parsing)
    const parsedLocations = parseLocationsFromMessage(processedMessage);
    console.log(`[AtlasAgent] Parsed locations:`, JSON.stringify(parsedLocations));

    // Check for international destinations
    if (parsedLocations.internationalDestination) {
      const response = `yurt disi yukler bakamiyorum abi, sadece turkiye ici. nerden nereye bakmami istersin?`;
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return { message: response, jobIds: [], context: {} as ConversationContext };
    }

    // Get Atlas intent for non-location queries
    const history = conversation?.messages
      ?.filter(m => m.role === 'user')
      ?.slice(-3)
      ?.map(m => ({ role: 'user' as const, content: m.content })) || [];

    const atlas = await parseIntent(processedMessage, history);
    console.log(`[AtlasAgent] Atlas response:`, JSON.stringify(atlas));

    // Save user message
    await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });

    // Handle based on intent and parsed locations
    let response: string;
    let jobIds: string[] = [];
    let contextUpdate: Partial<ConversationContext> = {};

    // If we have locations from parser, treat as search regardless of Atlas intent
    const hasLocations = parsedLocations.origin || parsedLocations.destination || parsedLocations.destinationRegion;

    if (hasLocations) {
      // Handle region search
      if (parsedLocations.destinationRegion && parsedLocations.destinations) {
        const regionResult = await this.handleRegionSearch(userId, parsedLocations, existingContext);
        response = regionResult.response;
        jobIds = regionResult.jobIds;
        contextUpdate = regionResult.contextUpdate;
      }
      // Handle multi-destination search
      else if (parsedLocations.destinations && parsedLocations.destinations.length > 1) {
        const multiResult = await this.handleMultiDestinationSearch(userId, parsedLocations, existingContext);
        response = multiResult.response;
        jobIds = multiResult.jobIds;
        contextUpdate = multiResult.contextUpdate;
      }
      // Handle same-province search
      else if (parsedLocations.sameProvinceSearch) {
        const sameProvinceResult = await this.handleSameProvinceSearch(userId, parsedLocations, existingContext);
        response = sameProvinceResult.response;
        jobIds = sameProvinceResult.jobIds;
        contextUpdate = sameProvinceResult.contextUpdate;
      }
      // Handle normal search
      else {
        const searchResult = await this.handleSearch(userId, processedMessage, atlas, parsedLocations, existingContext);
        response = searchResult.response;
        jobIds = searchResult.jobIds;
        contextUpdate = searchResult.contextUpdate;
      }
    } else {
      // No locations found - use Atlas intent
      switch (atlas.intent) {
        case 'search':
          // Atlas detected search but parser found nothing - use context or ask
          const searchResult = await this.handleSearch(userId, processedMessage, atlas, parsedLocations, existingContext);
          response = searchResult.response;
          jobIds = searchResult.jobIds;
          contextUpdate = searchResult.contextUpdate;
          break;

        case 'pagination':
          const paginationResult = await this.handlePagination(userId, existingContext);
          response = paginationResult.response;
          jobIds = paginationResult.jobIds;
          contextUpdate = paginationResult.contextUpdate;
          break;

        case 'intra_city':
          const intraCityResult = await this.handleIntraCity(userId, atlas, existingContext);
          response = intraCityResult.response;
          jobIds = intraCityResult.jobIds;
          contextUpdate = intraCityResult.contextUpdate;
          break;

        case 'vehicle_info':
          const vehicle = atlas.vehicle_type || atlas.cargo_type || 'aracın';
          response = getResponse('vehicle_info', { vehicle });
          contextUpdate = { preferredVehicle: vehicle };
          break;

        case 'location_info':
          const location = atlas.origin || 'burada';
          response = getResponse('location_info', { location });
          contextUpdate = { lastOrigin: atlas.origin || undefined };
          break;

        case 'greeting':
        case 'goodbye':
        case 'thanks':
        case 'bot_identity':
        case 'help':
        case 'pricing':
        case 'subscription':
        case 'support':
        case 'phone_question':
        case 'load_price':
        case 'load_details':
        case 'freshness':
        case 'feedback_positive':
        case 'feedback_negative':
        case 'confirmation':
        case 'negation':
        case 'clarification':
        case 'abuse':
        case 'spam':
        case 'international':
          response = getResponse(atlas.intent);
          break;

        case 'other':
        default:
          response = getResponse('other');
          break;
      }
    }

    // Save assistant response
    await this.conversationStore.addMessage(userId, { role: 'assistant', content: response }, contextUpdate);

    const duration = Date.now() - startTime;
    console.log(`[AtlasAgent] Response generated in ${duration}ms`);

    return {
      message: response,
      jobIds,
      context: contextUpdate as ConversationContext,
      intent: atlas.intent,
    };
  }

  /**
   * Handle job search with comprehensive parsing
   */
  private async handleSearch(
    userId: string,
    userMessage: string,
    atlas: AtlasResponse,
    parsed: ParsedLocations,
    existingContext?: ConversationContext
  ): Promise<{ response: string; jobIds: string[]; contextUpdate: Partial<ConversationContext> }> {
    // Parser takes precedence over Atlas (parser is more reliable for Turkish suffixes)
    // If parser found locations, use ONLY parser results - don't let Atlas fill in from context
    let origin: string | undefined;
    let destination: string | undefined;

    if (parsed.origin || parsed.destination) {
      // Parser found something - use only parser results
      origin = parsed.origin || undefined;
      destination = parsed.destination || undefined;
    } else if (atlas.success && (atlas.origin || atlas.destination)) {
      // Parser found nothing - validate Atlas isn't hallucinating from context
      // Only trust Atlas locations if they actually appear in the user message
      const msgLower = normalizeToAscii(userMessage.toLowerCase());
      const atlasOriginValid = atlas.origin && msgLower.includes(atlas.origin.toLowerCase().substring(0, 4));
      const atlasDestValid = atlas.destination && msgLower.includes(atlas.destination.toLowerCase().substring(0, 4));

      if (atlasOriginValid || atlasDestValid) {
        // Atlas found real locations in the message
        origin = atlasOriginValid ? atlas.origin || undefined : undefined;
        destination = atlasDestValid ? atlas.destination || undefined : undefined;
      } else {
        // Atlas hallucinated locations not in message - don't use them
        console.log(`[AtlasAgent] Ignoring Atlas hallucinated locations: ${atlas.origin} → ${atlas.destination}`);
      }
    }

    // Context fallback only when we have NOTHING
    if (!origin && !destination && existingContext) {
      origin = existingContext.lastOrigin;
      destination = existingContext.lastDestination;
    }

    // Normalize locations
    origin = this.normalizeLocation(origin);
    destination = this.normalizeLocation(destination);

    // If still no locations, ask
    if (!origin && !destination) {
      return {
        response: 'nerden nereye bakmamı istersin? örnek: istanbul ankara',
        jobIds: [],
        contextUpdate: {},
      };
    }

    // Build search params
    const params: SearchJobsParams = { limit: 10, offset: 0 };
    if (origin) params.origin = origin;
    if (destination) params.destination = destination;

    // Handle vehicle/body type classification
    this.classifyVehicleBodyTypes(params, atlas, userMessage, parsed);

    console.log(`[AtlasAgent] Searching jobs:`, params);

    // Execute search
    let result = await searchJobs(this.sql, params);

    // Parsiyel fallback: if no results with parsiyel filter, try without
    let parsiyelfallback = false;
    if (result.jobs.length === 0 && params.cargoType === 'parsiyel') {
      const fallbackParams = { ...params };
      delete fallbackParams.cargoType;
      const fallbackResult = await searchJobs(this.sql, fallbackParams);
      if (fallbackResult.jobs.length > 0) {
        result = fallbackResult;
        parsiyelfallback = true;
        console.log(`[AtlasAgent] Parsiyel fallback: found ${result.jobs.length} jobs`);
      }
    }

    // Format response
    let response: string;
    const contextUpdate: Partial<ConversationContext> = {
      lastOrigin: origin,
      lastDestination: destination,
      lastTotalCount: result.totalCount,
      lastOffset: 0,
      lastShownCount: result.jobs.length,
      lastVehicleType: params.vehicleType,
      lastBodyType: params.bodyType,
      lastCargoType: params.cargoType,
    };

    if (result.jobs.length === 0) {
      // No results - offer nearby search
      const route = origin && destination ? `${origin} ${destination}` : origin || destination || 'bu rota';
      response = `${route} arasi su an yuk yok abi.`;

      // Get neighboring provinces for suggestion
      const neighboringOrigins = origin ? getNeighboringProvinces(origin).slice(0, 3) : [];
      const neighboringDestinations = destination ? getNeighboringProvinces(destination).slice(0, 3) : [];

      if (neighboringOrigins.length > 0 || neighboringDestinations.length > 0) {
        contextUpdate.pendingNearbySuggestion = {
          origin,
          destination,
          neighboringOrigins,
          neighboringDestinations,
          vehicleType: params.vehicleType,
          bodyType: params.bodyType,
          cargoType: params.cargoType,
        };

        if (neighboringOrigins.length > 0 && neighboringDestinations.length > 0) {
          response += `\n\n*civarinda bakayim mi?* (cikis: ${neighboringOrigins.join(', ')} / varis: ${neighboringDestinations.join(', ')}) - bakmami istiyorsan *"evet"* yaz`;
        } else if (neighboringOrigins.length > 0) {
          response += `\n\n*${origin} civarinda bakayim mi?* (${neighboringOrigins.join(', ')}) - bakmami istiyorsan *"evet"* yaz`;
        } else {
          response += `\n\n*${destination} civarinda bakayim mi?* (${neighboringDestinations.join(', ')}) - bakmami istiyorsan *"evet"* yaz`;
        }
      } else {
        response += ' baska rota dene?';
      }
    } else {
      // Results found
      if (parsiyelfallback) {
        response = 'parsiyel olarak isaretlenmis is bulamadim abi, ama su isler var - numaralari arayip parsiyel var mi diye sorabilirsin:\n\n';
      } else {
        response = '';
      }

      response += this.formatJobResults(result.jobs);

      if (result.totalCount > result.jobs.length) {
        const remaining = result.totalCount - result.jobs.length;
        response += `\n\n_${remaining} yuk daha var, "devam" yaz gostereyim_`;
      }

      // Suggest vehicle filter if user has a preferred vehicle and we're not already filtering
      if (existingContext?.preferredVehicle && !params.vehicleType && result.jobs.length >= 5) {
        response += `\n\n*${existingContext.preferredVehicle} mu bakayim?* (evet de filtrelerim)`;
        contextUpdate.pendingVehicleSuggestion = true;
      }
    }

    return { response, jobIds: result.jobs.map(j => j.id), contextUpdate };
  }

  /**
   * Handle region search (e.g., "istanbuldan ege bolgesine")
   */
  private async handleRegionSearch(
    userId: string,
    parsed: ParsedLocations,
    existingContext?: ConversationContext
  ): Promise<{ response: string; jobIds: string[]; contextUpdate: Partial<ConversationContext> }> {
    const origin = parsed.origin || existingContext?.lastOrigin;
    const regionProvinces = parsed.destinations || [];

    if (!origin || regionProvinces.length === 0) {
      return {
        response: 'hangi bolgeye bakmami istersin? ornek: istanbuldan ege bolgesine',
        jobIds: [],
        contextUpdate: {},
      };
    }

    console.log(`[AtlasAgent] Region search: ${origin} -> ${parsed.destinationRegion} (${regionProvinces.length} provinces)`);

    // Search each province in the region
    const allJobs: JobResult[] = [];
    const jobsByDest: Record<string, JobResult[]> = {};

    for (const dest of regionProvinces.slice(0, 5)) { // Limit to 5 provinces
      const params: SearchJobsParams = {
        origin: this.normalizeLocation(origin),
        destination: this.normalizeLocation(dest),
        limit: 3,
      };
      const result = await searchJobs(this.sql, params);
      if (result.jobs.length > 0) {
        jobsByDest[dest] = result.jobs;
        allJobs.push(...result.jobs);
      }
    }

    if (allJobs.length === 0) {
      return {
        response: `${origin}'dan ${parsed.destinationRegion} bolgesine su an yuk yok abi. baska bolge dene?`,
        jobIds: [],
        contextUpdate: {
          lastOrigin: origin,
          lastDestination: undefined,
        },
      };
    }

    // Format grouped results
    let response = `${origin}'dan ${parsed.destinationRegion} bolgesine yukler:\n\n`;
    for (const [dest, jobs] of Object.entries(jobsByDest)) {
      response += `📍 *${dest}*:\n`;
      response += this.formatJobResults(jobs) + '\n\n';
    }

    return {
      response: response.trim(),
      jobIds: allJobs.map(j => j.id),
      contextUpdate: {
        lastOrigin: origin,
        lastDestination: regionProvinces[0],
        lastTotalCount: allJobs.length,
        lastOffset: 0,
        lastShownCount: allJobs.length,
      },
    };
  }

  /**
   * Handle multi-destination search (e.g., "samsundan istanbul ankara izmir")
   */
  private async handleMultiDestinationSearch(
    userId: string,
    parsed: ParsedLocations,
    existingContext?: ConversationContext
  ): Promise<{ response: string; jobIds: string[]; contextUpdate: Partial<ConversationContext> }> {
    const origin = parsed.origin || existingContext?.lastOrigin;
    const destinations = parsed.destinations || [];

    if (!origin || destinations.length === 0) {
      return {
        response: 'nerden nereye bakmami istersin?',
        jobIds: [],
        contextUpdate: {},
      };
    }

    console.log(`[AtlasAgent] Multi-destination search: ${origin} -> [${destinations.join(', ')}]`);

    // Search each destination
    const allJobs: JobResult[] = [];
    const jobsByDest: Record<string, JobResult[]> = {};

    for (const dest of destinations.slice(0, 5)) { // Limit to 5 destinations
      const params: SearchJobsParams = {
        origin: this.normalizeLocation(origin),
        destination: this.normalizeLocation(dest),
        limit: 3,
      };
      const result = await searchJobs(this.sql, params);
      if (result.jobs.length > 0) {
        jobsByDest[dest] = result.jobs;
        allJobs.push(...result.jobs);
      }
    }

    if (allJobs.length === 0) {
      return {
        response: `${origin}'dan ${destinations.join(', ')} yonune su an yuk yok abi.`,
        jobIds: [],
        contextUpdate: { lastOrigin: origin },
      };
    }

    // Format grouped results
    let response = `${origin}'dan yukler:\n\n`;
    for (const [dest, jobs] of Object.entries(jobsByDest)) {
      response += `📍 *${dest}*:\n`;
      response += this.formatJobResults(jobs) + '\n\n';
    }

    return {
      response: response.trim(),
      jobIds: allJobs.map(j => j.id),
      contextUpdate: {
        lastOrigin: origin,
        lastDestination: destinations[0],
        lastTotalCount: allJobs.length,
        lastOffset: 0,
        lastShownCount: allJobs.length,
      },
    };
  }

  /**
   * Handle same-province search (e.g., "kucukcekmece esenyurt" - both Istanbul)
   */
  private async handleSameProvinceSearch(
    userId: string,
    parsed: ParsedLocations,
    existingContext?: ConversationContext
  ): Promise<{ response: string; jobIds: string[]; contextUpdate: Partial<ConversationContext> }> {
    const province = parsed.originProvince || parsed.destinationProvince;

    if (!province) {
      return {
        response: 'nerden nereye bakmami istersin?',
        jobIds: [],
        contextUpdate: {},
      };
    }

    console.log(`[AtlasAgent] Same-province search detected: ${province}`);

    // First try intra-city
    const intraCityParams: SearchJobsParams = {
      origin: province,
      destination: province,
      limit: 5,
    };
    const intraCityResult = await searchJobs(this.sql, intraCityParams);

    // Then search FROM this city
    const fromCityParams: SearchJobsParams = {
      origin: province,
      limit: 10,
    };
    const fromCityResult = await searchJobs(this.sql, fromCityParams);

    if (intraCityResult.jobs.length === 0 && fromCityResult.jobs.length === 0) {
      return {
        response: `${province} ici ve ${province}'dan cikan yuk yok su an.`,
        jobIds: [],
        contextUpdate: { lastOrigin: province, lastDestination: province },
      };
    }

    let response = `*dikkat:* ${parsed.originDistrict || province} ve ${parsed.destinationDistrict || province} ayni sehir (${province}).\n`;

    if (intraCityResult.jobs.length > 0) {
      response += `\n${province} ici isler:\n`;
      response += this.formatJobResults(intraCityResult.jobs);
    } else {
      response += `${province} ici is az, `;
    }

    if (fromCityResult.jobs.length > 0) {
      response += `\n\n${province}'dan cikan isler:\n`;
      response += this.formatJobResults(fromCityResult.jobs.slice(0, 5));
    }

    return {
      response: response.trim(),
      jobIds: [...intraCityResult.jobs, ...fromCityResult.jobs].map(j => j.id),
      contextUpdate: {
        lastOrigin: province,
        lastDestination: undefined,
        lastTotalCount: fromCityResult.totalCount,
        lastOffset: 0,
        lastShownCount: fromCityResult.jobs.length,
      },
    };
  }

  /**
   * Handle vehicle suggestion confirmation
   */
  private async handleVehicleSuggestionConfirm(
    userId: string,
    context: ConversationContext
  ): Promise<AtlasAgentResponse> {
    const preferredVehicle = context.preferredVehicle;
    const lastOrigin = context.lastOrigin;
    const lastDestination = context.lastDestination;

    console.log(`[AtlasAgent] Vehicle suggestion confirmed: ${preferredVehicle}`);

    const params: SearchJobsParams = {
      origin: lastOrigin,
      destination: lastDestination,
      vehicleType: preferredVehicle,
      limit: 10,
    };

    const result = await searchJobs(this.sql, params);
    let response: string;

    if (result.jobs.length === 0) {
      response = `${preferredVehicle} isi su an yok abi. diger arac tipleri var, bak istersen.`;
    } else {
      response = `${preferredVehicle} isleri:\n\n${this.formatJobResults(result.jobs)}`;
      if (result.totalCount > result.jobs.length) {
        response += `\n\n_${result.totalCount - result.jobs.length} is daha var, "devam" yaz_`;
      }
    }

    const contextUpdate: Partial<ConversationContext> = {
      lastVehicleType: preferredVehicle,
      lastTotalCount: result.totalCount,
      lastOffset: 0,
      lastShownCount: result.jobs.length,
      pendingVehicleSuggestion: false,
    };

    await this.conversationStore.addMessage(userId, { role: 'assistant', content: response }, contextUpdate);

    return {
      message: response,
      jobIds: result.jobs.map(j => j.id),
      context: contextUpdate as ConversationContext,
    };
  }

  /**
   * Handle nearby search suggestion confirmation
   */
  private async handleNearbySuggestionConfirm(
    userId: string,
    context: ConversationContext
  ): Promise<AtlasAgentResponse> {
    const nearby = context.pendingNearbySuggestion;
    if (!nearby) {
      return {
        message: 'nerden nereye bakmami istersin?',
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    console.log(`[AtlasAgent] Nearby search confirmed:`, nearby);

    const allJobs: JobResult[] = [];
    const results: string[] = [];

    // Search neighboring origins
    if (nearby.neighboringOrigins && nearby.neighboringOrigins.length > 0) {
      for (const origin of nearby.neighboringOrigins) {
        const params: SearchJobsParams = {
          origin,
          destination: nearby.destination,
          vehicleType: nearby.vehicleType,
          bodyType: nearby.bodyType,
          cargoType: nearby.cargoType,
          limit: 3,
        };
        const result = await searchJobs(this.sql, params);
        if (result.jobs.length > 0) {
          results.push(`📍 *${origin}*'dan:\n${this.formatJobResults(result.jobs)}`);
          allJobs.push(...result.jobs);
        }
      }
    }

    // Search neighboring destinations
    if (nearby.neighboringDestinations && nearby.neighboringDestinations.length > 0) {
      for (const dest of nearby.neighboringDestinations) {
        const params: SearchJobsParams = {
          origin: nearby.origin,
          destination: dest,
          vehicleType: nearby.vehicleType,
          bodyType: nearby.bodyType,
          cargoType: nearby.cargoType,
          limit: 3,
        };
        const result = await searchJobs(this.sql, params);
        if (result.jobs.length > 0) {
          results.push(`📍 *${dest}*'a:\n${this.formatJobResults(result.jobs)}`);
          allJobs.push(...result.jobs);
        }
      }
    }

    let response: string;
    if (allJobs.length === 0) {
      response = 'civarda da yuk yok abi. baska rota dene?';
    } else {
      response = 'civardaki yukler:\n\n' + results.join('\n\n');
    }

    const contextUpdate: Partial<ConversationContext> = {
      pendingNearbySuggestion: undefined,
      lastTotalCount: allJobs.length,
      lastOffset: 0,
      lastShownCount: allJobs.length,
    };

    await this.conversationStore.addMessage(userId, { role: 'assistant', content: response }, contextUpdate);

    return {
      message: response,
      jobIds: allJobs.map(j => j.id),
      context: contextUpdate as ConversationContext,
    };
  }

  /**
   * Handle pagination
   */
  private async handlePagination(
    userId: string,
    existingContext?: ConversationContext
  ): Promise<{ response: string; jobIds: string[]; contextUpdate: Partial<ConversationContext> }> {
    if (!existingContext?.lastOrigin || !existingContext?.lastTotalCount) {
      return {
        response: 'once bi rota soyle, sonra devamini gostereyim. ornek: istanbul ankara',
        jobIds: [],
        contextUpdate: {},
      };
    }

    const currentOffset = (existingContext.lastOffset || 0) + (existingContext.lastShownCount || 10);

    if (currentOffset >= existingContext.lastTotalCount) {
      return {
        response: 'hepsini gosterdim abi, baska yuk yok. farkli rota dene?',
        jobIds: [],
        contextUpdate: {},
      };
    }

    const params: SearchJobsParams = {
      origin: existingContext.lastOrigin,
      destination: existingContext.lastDestination,
      vehicleType: existingContext.lastVehicleType,
      bodyType: existingContext.lastBodyType,
      cargoType: existingContext.lastCargoType,
      limit: 10,
      offset: currentOffset,
    };

    const result = await searchJobs(this.sql, params);
    const response = this.formatJobResults(result.jobs);

    const remaining = existingContext.lastTotalCount - currentOffset - result.jobs.length;
    const hint = remaining > 0 ? `\n\n_${remaining} yuk daha var, "devam" yaz_` : '';

    return {
      response: response + hint,
      jobIds: result.jobs.map(j => j.id),
      contextUpdate: {
        lastOffset: currentOffset,
        lastShownCount: result.jobs.length,
      },
    };
  }

  /**
   * Handle intra-city search
   */
  private async handleIntraCity(
    userId: string,
    atlas: AtlasResponse,
    existingContext?: ConversationContext
  ): Promise<{ response: string; jobIds: string[]; contextUpdate: Partial<ConversationContext> }> {
    const city = this.normalizeLocation(atlas.origin) || existingContext?.lastOrigin;

    if (!city) {
      return {
        response: 'hangi sehrin ici? ornek: istanbul ici',
        jobIds: [],
        contextUpdate: {},
      };
    }

    const params: SearchJobsParams = { origin: city, destination: city, limit: 10 };
    const result = await searchJobs(this.sql, params);

    if (result.jobs.length === 0) {
      const fromCityParams: SearchJobsParams = { origin: city, limit: 10 };
      const fromCityResult = await searchJobs(this.sql, fromCityParams);

      if (fromCityResult.jobs.length > 0) {
        const response = `${city} ici yuk yok abi, sehir ici nadir. ama ${city}'dan cikan var:\n\n` +
          this.formatJobResults(fromCityResult.jobs);
        return {
          response,
          jobIds: fromCityResult.jobs.map(j => j.id),
          contextUpdate: {
            lastOrigin: city,
            lastDestination: undefined,
            lastTotalCount: fromCityResult.totalCount,
            lastOffset: 0,
            lastShownCount: fromCityResult.jobs.length,
          },
        };
      }

      return {
        response: `${city} ici ve ${city}'dan cikan yuk yok su an.`,
        jobIds: [],
        contextUpdate: { lastOrigin: city, lastDestination: city },
      };
    }

    return {
      response: this.formatJobResults(result.jobs),
      jobIds: result.jobs.map(j => j.id),
      contextUpdate: {
        lastOrigin: city,
        lastDestination: city,
        lastTotalCount: result.totalCount,
        lastOffset: 0,
        lastShownCount: result.jobs.length,
      },
    };
  }

  /**
   * Classify vehicle/body types from Atlas output and message
   */
  private classifyVehicleBodyTypes(
    params: SearchJobsParams,
    atlas: AtlasResponse,
    userMessage: string,
    parsed: ParsedLocations
  ): void {
    const bodyTypes = ['tenteli', 'tente', 'damperli', 'damper', 'frigo', 'frigorifik', 'acik', 'kapali', 'lowbed', 'platform', 'sal'];
    const vehicleTypes = ['tir', 'kamyon', 'kamyonet', 'dorse', 'cekici', 'panelvan'];

    // Check if cargo_type is actually a body type
    if (atlas.cargo_type) {
      const ct = atlas.cargo_type.toLowerCase();
      if (bodyTypes.some(bt => ct.includes(bt))) {
        params.bodyType = atlas.cargo_type;
      } else if (vehicleTypes.some(vt => ct.includes(vt))) {
        params.vehicleType = atlas.cargo_type;
      } else {
        params.cargoType = atlas.cargo_type;
      }
    }

    // Check if vehicle_type is actually a body type
    if (atlas.vehicle_type) {
      const vt = atlas.vehicle_type.toLowerCase();
      if (bodyTypes.some(bt => vt.includes(bt))) {
        params.bodyType = atlas.vehicle_type;
      } else {
        params.vehicleType = atlas.vehicle_type;
      }
    }

    // Use cargo type from parser
    if (parsed.cargoType && !params.cargoType) {
      params.cargoType = parsed.cargoType;
    }

    // Fallback: parse from message directly
    if (!params.vehicleType && !params.bodyType) {
      const msg = userMessage.toLowerCase();
      for (const vt of vehicleTypes) {
        if (msg.includes(vt)) {
          params.vehicleType = vt;
          break;
        }
      }
      if (!params.vehicleType) {
        for (const bt of bodyTypes) {
          if (msg.includes(bt)) {
            params.bodyType = bt;
            break;
          }
        }
      }
    }
  }

  /**
   * Normalize location name to province
   */
  private normalizeLocation(location: string | null | undefined): string | undefined {
    if (!location) return undefined;

    const normalized = normalizeToAscii(location.toLowerCase().trim());

    const province = getProvinceByName(normalized);
    if (province) return province.name.toLowerCase();

    const districts = getDistrictsByName(normalized);
    if (districts.length > 0) {
      const provinceCode = districts[0].provinceCode;
      const districtProvince = getProvinceByName(String(provinceCode));
      if (districtProvince) return districtProvince.name.toLowerCase();
    }

    return normalized;
  }

  /**
   * Format job results as card-style text
   */
  private formatJobResults(jobs: JobResult[]): string {
    if (jobs.length === 0) return 'Yuk bulunamadi.';

    const cards: string[] = [];

    for (const job of jobs) {
      // Format origin with district if available
      let origin = job.originProvince || '?';
      if (job.originDistrict && job.originDistrict !== job.originProvince) {
        origin = `${job.originProvince}/${job.originDistrict}`;
      }

      // Format destination with district if available
      let destination = job.destinationProvince || '?';
      if (job.destinationDistrict && job.destinationDistrict !== job.destinationProvince) {
        destination = `${job.destinationProvince}/${job.destinationDistrict}`;
      }

      // Build card lines
      const cardLines: string[] = [];

      // Route line
      cardLines.push(`📍 *${origin} → ${destination}*`);

      // Vehicle/body type line
      const vehicleDetails: string[] = [];
      if (job.vehicleType) vehicleDetails.push(job.vehicleType);
      if (job.bodyType) vehicleDetails.push(job.bodyType.toLowerCase().replace(/_/g, ' '));
      if (job.isRefrigerated) vehicleDetails.push('frigorifik');
      if (job.weight && job.weight > 0) vehicleDetails.push(`${job.weight}t`);
      if (vehicleDetails.length > 0) {
        cardLines.push(`🚛 ${vehicleDetails.join(' | ')}`);
      }

      // Cargo type if available
      if (job.cargoType) {
        cardLines.push(`📦 ${job.cargoType}`);
      }

      // Urgent flag
      if (job.isUrgent) {
        cardLines.push(`🔴 ACiL`);
      }

      // Phone (formatted as Turkish +90)
      if (job.contactPhone) {
        cardLines.push(`📞 ${this.formatPhoneNumber(job.contactPhone)}`);
      }

      // Time posted
      if (job.postedAt) {
        cardLines.push(`🕐 ${this.formatTimeAgo(job.postedAt)}`);
      }

      cards.push(cardLines.join('\n'));
    }

    return cards.join('\n━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Format phone number in Turkish format (+90 5XX XXX XX XX)
   */
  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');

    if (cleaned.length === 12 && cleaned.startsWith('90')) {
      return `+90 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
    }
    if (cleaned.length === 10 && cleaned.startsWith('5')) {
      return `+90 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('05')) {
      return `+90 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9)}`;
    }
    if (!phone.startsWith('+')) {
      return `+90 ${phone}`;
    }
    return phone;
  }

  /**
   * Format time ago
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'az once';
    if (diffMins < 60) return `${diffMins} dk once`;
    if (diffHours < 24) return `${diffHours} saat once`;
    if (diffDays === 1) return 'dun';
    return `${diffDays} gun once`;
  }
}
